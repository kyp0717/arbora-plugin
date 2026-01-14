import React from 'react';
import { Box, Text } from 'ink';
import type { Diagram } from '../types/index.js';

interface DiagramNodeProps {
  diagram: Diagram;
  prefix: string;
  isSelected: boolean;
}

// Get icon for diagram type
function getDiagramIcon(type: string): string {
  switch (type) {
    case 'architecture': return '🏗';
    case 'flow': return '🔀';
    case 'sequence': return '📊';
    case 'erd': return '🗃';
    case 'state': return '🔄';
    case 'class': return '📦';
    case 'component': return '🧩';
    case 'deployment': return '🚀';
    default: return '📈';
  }
}

export function DiagramNode({ diagram, prefix, isSelected }: DiagramNodeProps) {
  const icon = getDiagramIcon(diagram.type);

  return (
    <Box>
      <Text dimColor>{prefix}</Text>
      <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
        {isSelected ? '› ' : '  '}
      </Text>
      <Text>{icon} </Text>
      <Text color="magenta" bold={isSelected}>{diagram.name}</Text>
      <Text dimColor> ({diagram.type})</Text>
      {isSelected && <Text dimColor> [o]pen</Text>}
    </Box>
  );
}
