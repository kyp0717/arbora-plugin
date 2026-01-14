import React from 'react';
import { Box, Text } from 'ink';
import { ScopeNode } from './ScopeNode.js';
import type { Phase } from '../types/index.js';

interface PhaseNodeProps {
  phase: Phase;
  prefix: string;
  childPrefix: string;
  isExpanded: boolean;
  isSelected: boolean;
  selectedScopeIdx?: number;
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
}: PhaseNodeProps) {
  const scopes = phase.scopes || [];
  const icon = isExpanded ? '▼' : '▶';
  const statusIcon = getStatusIcon(phase.status || 'queued');
  const statusColor = getStatusColor(phase.status || 'queued');

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
        <Text dimColor> {icon}</Text>
      </Box>

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
      {isExpanded && scopes.length > 0 && (
        <Text dimColor>{childPrefix.trimEnd()}</Text>
      )}
    </Box>
  );
}
