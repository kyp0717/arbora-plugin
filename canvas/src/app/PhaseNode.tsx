import React from 'react';
import { Box, Text } from 'ink';
import { ScopeNode } from './ScopeNode.js';
import { DiagramNode } from './DiagramNode.js';
import type { Phase } from '../types/index.js';

interface PhaseNodeProps {
  phase: Phase;
  prefix: string;
  childPrefix: string;
  isExpanded: boolean;
  isSelected: boolean;
  selectedScopeIdx?: number;
  selectedDiagramIdx?: number;
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

export function PhaseNode({
  phase,
  prefix,
  childPrefix,
  isExpanded,
  isSelected,
  selectedScopeIdx,
  selectedDiagramIdx,
}: PhaseNodeProps) {
  const scopes = phase.scopes || [];
  const diagrams = phase.diagrams || [];
  const hasChildren = scopes.length > 0 || diagrams.length > 0;
  const icon = isExpanded ? '▼' : '▶';
  const statusIcon = getStatusIcon(phase.status || 'queued');
  const statusColor = getStatusColor(phase.status || 'queued');

  // Show diagram count badge if phase has diagrams
  const diagramBadge = diagrams.length > 0 ? ` 📊${diagrams.length}` : '';

  return (
    <Box flexDirection="column">
      {/* Phase header */}
      <Box>
        <Text dimColor>{prefix}</Text>
        <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
          {isSelected ? '› ' : '  '}
        </Text>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text bold={isSelected}>{phase.name}</Text>
        <Text dimColor> ({phase.phase_type})</Text>
        <Text color="magenta">{diagramBadge}</Text>
        <Text dimColor> {icon}</Text>
      </Box>

      {/* Diagrams (if expanded, shown before scopes) */}
      {isExpanded && diagrams.map((diagram, diagIdx) => {
        const isLastItem = scopes.length === 0 && diagIdx === diagrams.length - 1;
        const diagPrefix = childPrefix + (isLastItem ? '└─' : '├─');
        const isDiagramSelected = selectedDiagramIdx === diagIdx;

        return (
          <DiagramNode
            key={diagram.name}
            diagram={diagram}
            prefix={diagPrefix}
            isSelected={isDiagramSelected}
          />
        );
      })}

      {/* Scopes (if expanded) */}
      {isExpanded && scopes.map((scope, scopeIdx) => {
        const isLastScope = scopeIdx === scopes.length - 1;
        const scopePrefix = childPrefix + (isLastScope ? '└─' : '├─');
        const scopeChildPrefix = childPrefix + (isLastScope ? '   ' : '│  ');
        const isScopeSelected = selectedScopeIdx === scopeIdx;

        return (
          <ScopeNode
            key={scope.id || scopeIdx}
            scope={scope}
            prefix={scopePrefix}
            childPrefix={scopeChildPrefix}
            isSelected={isScopeSelected}
          />
        );
      })}

      {/* Spacing after phase */}
      {isExpanded && hasChildren && (
        <Text dimColor>{childPrefix.trimEnd()}</Text>
      )}
    </Box>
  );
}
