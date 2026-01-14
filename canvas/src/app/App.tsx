import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { TreeView } from './TreeView.js';
import type { DraftTree } from '../types/index.js';

interface AppProps {
  initialData?: DraftTree;
  watchFile?: string;
}

export function App({ initialData, watchFile }: AppProps) {
  const { exit } = useApp();
  const [data, setData] = useState<DraftTree | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const lastMtimeRef = useRef<number>(0);

  // Watch file for updates
  useEffect(() => {
    if (!watchFile) return;

    const checkFile = async () => {
      try {
        const file = Bun.file(watchFile);
        if (await file.exists()) {
          // Check modification time to detect changes
          const mtime = file.lastModified;
          if (mtime > lastMtimeRef.current) {
            lastMtimeRef.current = mtime;
            // Read file fresh
            const content = await file.text();
            if (content.trim()) {
              const parsed = JSON.parse(content);
              setData(parsed);
              setError(null);
            }
          }
        }
      } catch (e) {
        // Ignore parse errors during updates
      }
    };

    // Initial load
    checkFile();

    // Poll for changes
    const interval = setInterval(checkFile, 500);

    return () => clearInterval(interval);
  }, [watchFile]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
  });

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">Waiting for draft data...</Text>
        <Text dimColor>Watching: {watchFile}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <TreeView data={data} />
    </Box>
  );
}
