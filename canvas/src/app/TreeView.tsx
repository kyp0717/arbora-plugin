import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { PhaseNode } from './PhaseNode.js';
import { ScopeNode } from './ScopeNode.js';
import type { DraftTree, Phase, Diagram, Task } from '../types/index.js';
import { spawn } from 'bun';
import { tmpdir } from 'os';
import { join } from 'path';

// Task checkbox component for flat template
function TaskItem({ task, isLast }: { task: Task; isLast: boolean }) {
  const prefix = isLast ? '└─' : '├─';
  const checkbox = task.completed ? '[✓]' : '[ ]';
  const textColor = task.completed ? 'green' : 'white';

  return (
    <Box>
      <Text dimColor>{prefix} </Text>
      <Text color={textColor}>{checkbox} {task.title}</Text>
    </Box>
  );
}

interface TreeViewProps {
  data: DraftTree;
}

type NavItemType = 'phase' | 'diagram' | 'scope';

interface NavItem {
  type: NavItemType;
  phaseIdx: number;
  diagramIdx?: number;
  scopeIdx?: number;
  diagram?: Diagram;
}

// Calculate stats for all template types
function calcStats(data: DraftTree): { completed: number; total: number; diagrams: number } {
  let completed = 0;
  let total = 0;
  let diagrams = 0;

  // Flat template: tasks directly on draft
  for (const task of data.tasks || []) {
    total++;
    if (task.completed) completed++;
  }

  // Spatial template: scopes directly on draft
  for (const scope of data.scopes || []) {
    for (const task of scope.tasks || []) {
      total++;
      if (task.completed) completed++;
    }
  }

  // Matrix/temporal template: phases -> scopes -> tasks
  for (const phase of data.phases || []) {
    diagrams += (phase.diagrams || []).length;
    for (const scope of phase.scopes || []) {
      for (const task of scope.tasks || []) {
        total++;
        if (task.completed) completed++;
      }
    }
  }

  return { completed, total, diagrams };
}

// Get status color
function getStatusColor(status: string): string {
  switch (status) {
    case 'done': return 'green';
    case 'active': return 'yellow';
    case 'queued': return 'gray';
    case 'dropped': return 'red';
    default: return 'white';
  }
}

// Color classes for node styling in browser diagrams
const BROWSER_COLOR_CLASSES = `
    classDef purple fill:#8b5cf6,stroke:#7c3aed,color:#fff
    classDef green fill:#10b981,stroke:#059669,color:#fff
    classDef blue fill:#3b82f6,stroke:#2563eb,color:#fff
    classDef orange fill:#f97316,stroke:#ea580c,color:#fff
    classDef pink fill:#ec4899,stroke:#db2777,color:#fff
    classDef red fill:#ef4444,stroke:#dc2626,color:#fff
    classDef yellow fill:#eab308,stroke:#ca8a04,color:#1e1e2e
    classDef gray fill:#374151,stroke:#4b5563,color:#9ca3af
    classDef cyan fill:#06b6d4,stroke:#0891b2,color:#fff`;

// Inject color classes into diagram content for browser rendering
function injectColorClasses(content: string): string {
  // Skip if already has classDef
  if (content.includes('classDef')) {
    return content;
  }

  // Find the graph/flowchart declaration line
  const lines = content.split('\n');
  const graphLineIndex = lines.findIndex(line =>
    /^\s*(graph|flowchart)\b/i.test(line)
  );

  if (graphLineIndex === -1) {
    return content;
  }

  // Insert color classes after graph declaration
  const beforeGraph = lines.slice(0, graphLineIndex + 1);
  const afterGraph = lines.slice(graphLineIndex + 1);

  return [...beforeGraph, BROWSER_COLOR_CLASSES, ...afterGraph].join('\n');
}

// Open diagram in browser
async function openDiagram(diagram: Diagram): Promise<void> {
  // Inject color classes if this is a graph/flowchart
  const themedContent = injectColorClasses(diagram.content);

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>${diagram.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #11111b;
      color: #cdd6f4;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      min-height: 100vh;
    }
    h1 { color: #00d9ff; margin-bottom: 5px; font-size: 2rem; }
    .type { color: #6c7086; margin-bottom: 30px; font-size: 1rem; }
    .mermaid {
      background: #1e1e2e;
      padding: 30px;
      border-radius: 12px;
      border: 1px solid #45475a;
    }
  </style>
</head>
<body>
  <h1>${diagram.name}</h1>
  <div class="type">${diagram.type}</div>
  <div class="mermaid">
${themedContent}
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1e1e2e',
        primaryTextColor: '#cdd6f4',
        primaryBorderColor: '#45475a',
        lineColor: '#6c7086',
        secondaryColor: '#313244',
        tertiaryColor: '#45475a',
        background: '#11111b',
        nodeBorder: '#45475a',
        clusterBkg: '#1e1e2e',
        clusterBorder: '#45475a',
        titleColor: '#cdd6f4'
      }
    });
  </script>
</body>
</html>`;

  const htmlPath = join(tmpdir(), `arbora-diagram-${Date.now()}.html`);
  await Bun.write(htmlPath, htmlContent);

  // Open in browser
  const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn([openCmd, htmlPath]);
}

export function TreeView({ data }: TreeViewProps) {
  const phases = data.phases || [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0]));
  const [message, setMessage] = useState<string | null>(null);

  // Build navigable items list (includes diagrams)
  const navItems = useMemo(() => {
    const items: NavItem[] = [];

    phases.forEach((phase, phaseIdx) => {
      items.push({ type: 'phase', phaseIdx });

      if (expandedPhases.has(phaseIdx)) {
        // Add diagrams first
        (phase.diagrams || []).forEach((diagram, diagramIdx) => {
          items.push({ type: 'diagram', phaseIdx, diagramIdx, diagram });
        });

        // Then scopes
        (phase.scopes || []).forEach((_, scopeIdx) => {
          items.push({ type: 'scope', phaseIdx, scopeIdx });
        });
      }
    });

    return items;
  }, [phases, expandedPhases]);

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(navItems.length - 1, i + 1));
    } else if (key.rightArrow || key.return) {
      const item = navItems[selectedIndex];
      if (item?.type === 'phase') {
        setExpandedPhases(prev => {
          const next = new Set(prev);
          next.add(item.phaseIdx);
          return next;
        });
      } else if (item?.type === 'diagram' && item.diagram) {
        // Open diagram on Enter
        openDiagram(item.diagram);
        setMessage(`Opening "${item.diagram.name}" in browser...`);
        setTimeout(() => setMessage(null), 2000);
      }
    } else if (key.leftArrow) {
      const item = navItems[selectedIndex];
      if (item?.type === 'phase') {
        setExpandedPhases(prev => {
          const next = new Set(prev);
          next.delete(item.phaseIdx);
          return next;
        });
      } else if (item?.type === 'scope' || item?.type === 'diagram') {
        // Move selection to parent phase and collapse
        const phaseNavIdx = navItems.findIndex(
          n => n.type === 'phase' && n.phaseIdx === item.phaseIdx
        );
        if (phaseNavIdx >= 0) {
          setSelectedIndex(phaseNavIdx);
          setExpandedPhases(prev => {
            const next = new Set(prev);
            next.delete(item.phaseIdx);
            return next;
          });
        }
      }
    } else if (input === 'o') {
      // Open diagram with 'o' key
      const item = navItems[selectedIndex];
      if (item?.type === 'diagram' && item.diagram) {
        openDiagram(item.diagram);
        setMessage(`Opening "${item.diagram.name}" in browser...`);
        setTimeout(() => setMessage(null), 2000);
      }
    } else if (input === 'a') {
      // Expand all
      setExpandedPhases(new Set(phases.map((_, i) => i)));
    } else if (input === 'c') {
      // Collapse all
      setExpandedPhases(new Set());
    }
  });

  const stats = calcStats(data);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">📋 </Text>
          <Text bold>{data.draft?.name || 'Draft'}</Text>
          <Text dimColor> [{data.draft?.draft_type}] </Text>
          <Text color={getStatusColor(data.draft?.status || 'queued')}>
            {data.draft?.status}
          </Text>
        </Box>
        <Text dimColor>   {data.draft?.id}</Text>
      </Box>

      <Text dimColor>│</Text>

      {/* Flat template: tasks directly under draft */}
      {data.template === 'flat' && data.tasks && data.tasks.length > 0 && (
        <Box flexDirection="column">
          {data.tasks.map((task, idx) => (
            <TaskItem
              key={task.id || idx}
              task={task}
              isLast={idx === data.tasks!.length - 1}
            />
          ))}
        </Box>
      )}

      {/* Spatial template: scopes directly under draft */}
      {data.template === 'spatial' && data.scopes && data.scopes.length > 0 && (
        <Box flexDirection="column">
          {data.scopes.map((scope, idx) => (
            <ScopeNode
              key={scope.id || idx}
              scope={scope}
              prefix={idx === data.scopes!.length - 1 ? '└─' : '├─'}
              childPrefix={idx === data.scopes!.length - 1 ? '   ' : '│  '}
              isSelected={false}
            />
          ))}
        </Box>
      )}

      {/* Matrix/temporal template: phases */}
      {phases.map((phase, phaseIdx) => {
        const isExpanded = expandedPhases.has(phaseIdx);
        const isLast = phaseIdx === phases.length - 1;
        const prefix = isLast ? '└─' : '├─';
        const childPrefix = isLast ? '   ' : '│  ';

        // Check if this phase is selected
        const phaseNavIdx = navItems.findIndex(
          n => n.type === 'phase' && n.phaseIdx === phaseIdx
        );
        const isPhaseSelected = selectedIndex === phaseNavIdx;

        // Find selected diagram/scope within this phase
        const currentItem = navItems[selectedIndex];
        const selectedDiagramIdx =
          currentItem?.type === 'diagram' && currentItem.phaseIdx === phaseIdx
            ? currentItem.diagramIdx
            : undefined;
        const selectedScopeIdx =
          currentItem?.type === 'scope' && currentItem.phaseIdx === phaseIdx
            ? currentItem.scopeIdx
            : undefined;

        return (
          <PhaseNode
            key={phase.id || phaseIdx}
            phase={phase}
            prefix={prefix}
            childPrefix={childPrefix}
            isExpanded={isExpanded}
            isSelected={isPhaseSelected}
            selectedDiagramIdx={selectedDiagramIdx}
            selectedScopeIdx={selectedScopeIdx}
          />
        );
      })}

      {/* Stats */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{'─'.repeat(50)}</Text>
        <Box>
          <Text>📊 </Text>
          <Text>{data.stats?.phases || phases.length} phases, </Text>
          <Text>{data.stats?.scopes || 0} scopes, </Text>
          <Text>{stats.completed}/{data.stats?.tasks || stats.total} tasks</Text>
          {stats.diagrams > 0 && <Text color="magenta">, {stats.diagrams} diagrams</Text>}
        </Box>
      </Box>

      {/* Message */}
      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      {/* Navigation instructions */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>↑↓  navigate</Text>
        <Text dimColor>←→  collapse/expand</Text>
        <Text dimColor>⏎   open diagram</Text>
        <Text dimColor>a/c expand/collapse all</Text>
        <Text dimColor>q   quit</Text>
      </Box>
    </Box>
  );
}
