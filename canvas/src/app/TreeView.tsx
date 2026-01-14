import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { PhaseNode } from './PhaseNode.js';
import type { DraftTree, Phase, Diagram } from '../types/index.js';
import { spawn } from 'bun';
import { tmpdir } from 'os';
import { join } from 'path';

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

// Calculate stats
function calcStats(data: DraftTree): { completed: number; total: number; diagrams: number } {
  let completed = 0;
  let total = 0;
  let diagrams = 0;

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

// Open diagram in browser
async function openDiagram(diagram: Diagram): Promise<void> {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>${diagram.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    h1 { color: #00d9ff; margin-bottom: 5px; }
    .type { color: #888; margin-bottom: 20px; }
    .mermaid { background: #16213e; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${diagram.name}</h1>
  <div class="type">${diagram.type}</div>
  <div class="mermaid">
${diagram.content}
  </div>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
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
  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text color="cyan">📋 </Text>
        <Text bold>{data.draft?.name || 'Draft'}</Text>
        <Text dimColor> [{data.draft?.draft_type}] </Text>
        <Text color={getStatusColor(data.draft?.status || 'queued')}>
          {data.draft?.status}
        </Text>
      </Box>

      <Text dimColor>│</Text>

      {/* Phases */}
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
          <Text>{data.stats?.tasks || stats.total} tasks</Text>
          {stats.diagrams > 0 && <Text color="magenta">, {stats.diagrams} diagrams</Text>}
        </Box>
        <Box>
          <Text>Progress: </Text>
          <Text color={progress === 100 ? 'green' : progress > 50 ? 'yellow' : 'white'}>
            {progressBar}
          </Text>
          <Text> {progress}%</Text>
        </Box>
      </Box>

      {/* Message */}
      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}
    </Box>
  );
}
