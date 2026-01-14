#!/usr/bin/env bun
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { renderTree } from './renderer/tree.js';
import { renderDiagram } from './renderer/diagram.js';
import { spawnPane, updatePane, closePane, getPaneId, inTmux, hasTmux, spawnServe, CONTENT_FILE } from './terminal/tmux.js';
import { App } from './app/App.js';
import type { DraftTree, Diagram } from './types/index.js';

const program = new Command();

program
  .name('arbora-canvas')
  .description('Canvas renderer for Arbora drafts in tmux panes')
  .version('0.1.0');

program
  .command('render')
  .description('Render a draft tree to the canvas pane')
  .option('-j, --json <json>', 'Draft tree JSON string')
  .option('-f, --file <path>', 'Path to JSON file containing draft tree')
  .option('--no-pane', 'Output to stdout instead of tmux pane')
  .option('--layout <layout>', 'Pane layout: split-right or split-bottom', 'split-right')
  .option('--width <percent>', 'Pane width percentage', '40')
  .option('--force', 'Try to spawn pane even if not in tmux (for testing)')
  .action(async (options) => {
    let data: DraftTree;

    if (options.json) {
      data = JSON.parse(options.json);
    } else if (options.file) {
      const file = Bun.file(options.file);
      data = await file.json();
    } else {
      // Read from stdin
      const input = await Bun.stdin.text();
      data = JSON.parse(input);
    }

    const output = renderTree(data);

    // Auto-fallback to stdout if tmux not available
    const tmuxAvailable = await hasTmux();
    const inTmuxSession = await inTmux();

    if (options.pane === false || (!tmuxAvailable && !options.force)) {
      if (!tmuxAvailable && options.pane !== false) {
        console.error('[tmux not installed - outputting to stdout]\n');
      }
      console.log(output);
    } else if (!inTmuxSession && !options.force) {
      console.error('[not in tmux session - outputting to stdout]\n');
      console.log(output);
    } else {
      const existingPane = await getPaneId();
      if (existingPane) {
        await updatePane(existingPane, output);
      } else {
        await spawnPane(output, {
          layout: options.layout,
          widthPercent: parseInt(options.width, 10),
          force: options.force,
        });
      }
    }
  });

program
  .command('diagram')
  .description('Render a mermaid diagram')
  .option('-j, --json <json>', 'Diagram JSON string')
  .option('-c, --content <content>', 'Raw mermaid content')
  .option('-n, --name <name>', 'Diagram name', 'Diagram')
  .option('-t, --type <type>', 'Diagram type', 'flow')
  .option('-w, --width <width>', 'Output width in characters', '80')
  .action(async (options) => {
    let diagram: Diagram;

    if (options.json) {
      diagram = JSON.parse(options.json);
    } else if (options.content) {
      diagram = {
        name: options.name,
        type: options.type,
        content: options.content,
      };
    } else {
      // Read from stdin
      const input = await Bun.stdin.text();
      try {
        diagram = JSON.parse(input);
      } catch {
        // Treat as raw mermaid content
        diagram = {
          name: options.name,
          type: options.type,
          content: input,
        };
      }
    }

    const output = await renderDiagram(diagram, parseInt(options.width, 10));
    console.log(output);
  });

program
  .command('serve')
  .description('Run interactive TUI with live updates')
  .option('-w, --watch <path>', 'File to watch for updates', CONTENT_FILE)
  .option('-j, --json <json>', 'Initial draft tree JSON')
  .action(async (options) => {
    let initialData: DraftTree | undefined;

    if (options.json) {
      initialData = JSON.parse(options.json);
    }

    // Render the Ink app
    const { waitUntilExit } = render(
      React.createElement(App, {
        initialData,
        watchFile: options.watch,
      })
    );

    await waitUntilExit();
  });

program
  .command('start')
  .description('Start canvas TUI in a tmux pane')
  .option('--layout <layout>', 'Pane layout: split-right or split-bottom', 'split-right')
  .option('--width <percent>', 'Pane width percentage', '40')
  .option('-j, --json <json>', 'Initial draft tree JSON')
  .action(async (options) => {
    const tmuxAvailable = await hasTmux();
    const inTmuxSession = await inTmux();

    if (!tmuxAvailable || !inTmuxSession) {
      console.error('Error: Must be in a tmux session to start canvas pane');
      process.exit(1);
    }

    // Write initial data if provided
    if (options.json) {
      await Bun.write(CONTENT_FILE, options.json);
    }

    // Spawn the serve command in a new pane
    const paneId = await spawnServe({
      layout: options.layout,
      widthPercent: parseInt(options.width, 10),
    });

    console.log(`Canvas started in pane ${paneId}`);
  });

program
  .command('update')
  .description('Update canvas with new draft data')
  .option('-j, --json <json>', 'Draft tree JSON string')
  .action(async (options) => {
    if (!options.json) {
      console.error('Error: --json is required');
      process.exit(1);
    }

    // Write to the watch file - the running TUI will pick it up
    await Bun.write(CONTENT_FILE, options.json);
    console.log('Canvas updated');
  });

program
  .command('close')
  .description('Close the canvas pane')
  .action(async () => {
    const paneId = await getPaneId();
    if (paneId) {
      await closePane(paneId);
      console.log('Canvas pane closed');
    } else {
      console.log('No active canvas pane');
    }
  });

program
  .command('status')
  .description('Check if canvas pane is active')
  .action(async () => {
    const paneId = await getPaneId();
    if (paneId) {
      console.log(`Canvas pane active: ${paneId}`);
    } else {
      console.log('No active canvas pane');
    }
  });

program.parse();
