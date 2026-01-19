import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { watch, type FSWatcher } from 'fs';
import { TreeView } from './TreeView.js';
import { createDraftStore, parseDelta, type DraftStore } from '../store/index.js';
import type { DraftTree, Delta } from '../types/index.js';

// File paths
const DATA_FILE = '/tmp/arbora-canvas-data.json';
const DELTA_FILE = '/tmp/arbora-canvas-deltas.jsonl';

interface AppProps {
  initialData?: DraftTree;
  watchFile?: string;
}

export function App({ initialData, watchFile }: AppProps) {
  const { exit } = useApp();
  const [data, setData] = useState<DraftTree | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const storeRef = useRef<DraftStore>(createDraftStore());
  const deltaPositionRef = useRef<number>(0);
  const watchersRef = useRef<FSWatcher[]>([]);

  // Initialize store with initial data
  useEffect(() => {
    if (initialData) {
      storeRef.current.setDraft(initialData);
    }
  }, [initialData]);

  // Process new deltas from the delta file
  const processDeltas = useCallback(async () => {
    try {
      const file = Bun.file(DELTA_FILE);
      if (!(await file.exists())) return;

      const content = await file.text();
      const lines = content.split('\n').filter(l => l.trim());

      // Process only new lines (after our last position)
      const newLines = lines.slice(deltaPositionRef.current);
      if (newLines.length === 0) return;

      for (const line of newLines) {
        const delta = parseDelta(line);
        if (delta) {
          storeRef.current.applyDelta(delta);
        }
      }

      // Update position
      deltaPositionRef.current = lines.length;

      // Update React state from store
      const updatedDraft = storeRef.current.getDraft();
      if (updatedDraft) {
        setData({ ...updatedDraft });
        setPendingCount(storeRef.current.pendingDeltas.length);
      }
    } catch (e) {
      // Ignore errors during delta processing
    }
  }, []);

  // Handle full data file updates (initial load and periodic sync)
  const loadFullData = useCallback(async () => {
    try {
      const dataPath = watchFile || DATA_FILE;
      const file = Bun.file(dataPath);
      if (!(await file.exists())) return;

      const content = await file.text();
      if (content.trim()) {
        const parsed = JSON.parse(content) as DraftTree;
        storeRef.current.applyServerUpdate(parsed);
        setData(parsed);
        setPendingCount(0);
        setError(null);

        // Reset delta position since we have fresh data
        deltaPositionRef.current = 0;
        // Clear the delta file
        await Bun.write(DELTA_FILE, '');
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, [watchFile]);

  // Set up file watchers
  useEffect(() => {
    const dataPath = watchFile || DATA_FILE;

    // Initial load
    loadFullData();

    // Watch delta file for changes (optimistic updates)
    try {
      const deltaWatcher = watch(DELTA_FILE, (eventType) => {
        if (eventType === 'change') {
          processDeltas();
        }
      });
      watchersRef.current.push(deltaWatcher);
    } catch {
      // Delta file may not exist yet, that's ok
    }

    // Watch data file for full updates (server sync)
    try {
      const dataWatcher = watch(dataPath, (eventType) => {
        if (eventType === 'change') {
          loadFullData();
        }
      });
      watchersRef.current.push(dataWatcher);
    } catch {
      // Fall back to polling if watch fails
      const interval = setInterval(loadFullData, 2000);
      return () => {
        clearInterval(interval);
        watchersRef.current.forEach(w => w.close());
        watchersRef.current = [];
      };
    }

    // Periodic full sync for consistency (every 30 seconds)
    const syncInterval = setInterval(loadFullData, 30000);

    return () => {
      clearInterval(syncInterval);
      watchersRef.current.forEach(w => w.close());
      watchersRef.current = [];
    };
  }, [watchFile, loadFullData, processDeltas]);

  // Ensure delta file exists
  useEffect(() => {
    (async () => {
      const file = Bun.file(DELTA_FILE);
      if (!(await file.exists())) {
        await Bun.write(DELTA_FILE, '');
      }
    })();
  }, []);

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
        <Text dimColor>Watching: {watchFile || DATA_FILE}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <TreeView data={data} />
      {pendingCount > 0 && (
        <Box marginTop={1}>
          <Text dimColor>⟳ {pendingCount} pending sync</Text>
        </Box>
      )}
    </Box>
  );
}
