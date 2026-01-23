#!/usr/bin/env bun
import { Command } from 'commander';
import { renderTree } from './renderer/tree.js';
import { renderDiagram } from './renderer/diagram.js';
import type { DraftTree, Diagram } from './types/index.js';

const program = new Command();

program
  .name('arbora-canvas')
  .description('Canvas renderer for Arbora drafts (inline output only)')
  .version('0.1.0');

program
  .command('render')
  .description('Render a draft tree to stdout')
  .option('-j, --json <json>', 'Draft tree JSON string')
  .option('-f, --file <path>', 'Path to JSON file containing draft tree')
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
    console.log(output);
  });

program
  .command('diagram')
  .description('Render a mermaid diagram to stdout')
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

program.parse();
