import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { PhaseNode } from './PhaseNode.js';
import type { DraftTree, Phase } from '../types/index.js';

interface TreeViewProps {
  data: DraftTree;
}

// Calculate stats
function calcStats(data: DraftTree): { completed: number; total: number } {
  let completed = 0;
  let total = 0;

  for (const phase of data.phases || []) {
    for (const scope of phase.scopes || []) {
      for (const task of scope.tasks || []) {
        total++;
        if (task.completed) completed++;
      }
    }
  }

  return { completed, total };
}

// Get status icon
function getStatusIcon(status: string): string {
  switch (status) {
    case 'done': return '✓';
    case 'active': return '●';
    case 'queued': return '○';
    case 'dropped': return '✗';
    default: return '○';
  }
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

export function TreeView({ data }: TreeViewProps) {
  const phases = data.phases || [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0]));

  // Build navigable items list
  const navItems = useMemo(() => {
    const items: { type: 'phase' | 'scope'; phaseIdx: number; scopeIdx?: number }[] = [];

    phases.forEach((phase, phaseIdx) => {
      items.push({ type: 'phase', phaseIdx });

      if (expandedPhases.has(phaseIdx)) {
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
      }
    } else if (key.leftArrow) {
      const item = navItems[selectedIndex];
      if (item?.type === 'phase') {
        setExpandedPhases(prev => {
          const next = new Set(prev);
          next.delete(item.phaseIdx);
          return next;
        });
      } else if (item?.type === 'scope') {
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

        // Check if this phase or any of its scopes is selected
        const phaseNavIdx = navItems.findIndex(
          n => n.type === 'phase' && n.phaseIdx === phaseIdx
        );
        const isPhaseSelected = selectedIndex === phaseNavIdx;

        return (
          <PhaseNode
            key={phase.id || phaseIdx}
            phase={phase}
            prefix={prefix}
            childPrefix={childPrefix}
            isExpanded={isExpanded}
            isSelected={isPhaseSelected}
            selectedScopeIdx={
              navItems[selectedIndex]?.type === 'scope' &&
              navItems[selectedIndex]?.phaseIdx === phaseIdx
                ? navItems[selectedIndex].scopeIdx
                : undefined
            }
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
        </Box>
        <Box>
          <Text>Progress: </Text>
          <Text color={progress === 100 ? 'green' : progress > 50 ? 'yellow' : 'white'}>
            {progressBar}
          </Text>
          <Text> {progress}%</Text>
        </Box>
      </Box>
    </Box>
  );
}
