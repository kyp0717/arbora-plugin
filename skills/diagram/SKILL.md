---
name: diagram
description: Render mermaid diagrams from a draft to the terminal
allowed-tools:
  - mcp__arbora__call_tool
  - Bash
---

# Diagram Skill

Renders mermaid diagrams attached to drafts or phases as terminal graphics.

## Usage

When the user runs `/arbora:diagram`, follow these steps:

1. **Find diagrams to render**:
   - If a draft ID/name is provided, fetch that draft with `tree: true`
   - Otherwise, get the active draft

2. **Fetch the draft tree**:
   ```
   tool_name: "draft_get"
   params: {"id": "<draft_id>", "tree": true}
   ```

3. **Extract diagrams** from the response:
   - Check `phases[].diagrams` for phase-level diagrams
   - Check `draft.diagrams` for draft-level diagrams (if present)

4. **Render each diagram** using the canvas CLI:
   ```bash
   echo '<diagram_json>' | bun run ${CLAUDE_PLUGIN_ROOT}/canvas/src/cli.ts diagram
   ```

## Arguments
$ARGUMENTS

If arguments specify a diagram name, render only that diagram.

## Requirements

For best results, ensure these are installed:
- `mmdc` (mermaid-cli): `npm install -g @mermaid-js/mermaid-cli`
- `chafa` (terminal graphics): `apt install chafa` or `brew install chafa`

## Supported Diagram Types

- architecture
- flow
- sequence
- erd
- state
- class
- component
- deployment
