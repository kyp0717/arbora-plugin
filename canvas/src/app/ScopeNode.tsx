import React from 'react';
import { Box, Text } from 'ink';
import type { Scope } from '../types/index.js';

interface ScopeNodeProps {
  scope: Scope;
  prefix: string;
  childPrefix: string;
  isSelected: boolean;
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

export function ScopeNode({ scope, prefix, childPrefix, isSelected }: ScopeNodeProps) {
  const tasks = scope.tasks || [];
  const statusIcon = getStatusIcon(scope.status || 'queued');
  const statusColor = getStatusColor(scope.status || 'queued');

  return (
    <Box flexDirection="column">
      {/* Scope header */}
      <Box>
        <Text dimColor>{prefix}</Text>
        <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
          {isSelected ? '› ' : '  '}
        </Text>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text bold={isSelected}>{scope.name}</Text>
        <Text dimColor> ({scope.scope_type})</Text>
      </Box>

      {/* Tasks */}
      {tasks.map((task, taskIdx) => {
        const isLastTask = taskIdx === tasks.length - 1;
        const taskPrefix = childPrefix + (isLastTask ? '└─' : '├─');
        const checkbox = task.completed ? '[✓]' : '[ ]';
        const textColor = task.completed ? 'green' : undefined;
        const dimmed = task.completed;

        return (
          <Box key={task.id || taskIdx}>
            <Text dimColor>{taskPrefix}</Text>
            <Text color={textColor} dimColor={dimmed}> {checkbox} </Text>
            <Text dimColor={dimmed}>{task.title}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
