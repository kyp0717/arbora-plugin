---
name: canvas
description: Open a canvas pane showing the current draft tree with live updates
allowed-tools:
  - mcp__arbora__call_tool
  - Bash
---

# Canvas Skill

Opens a tmux pane displaying the current draft as a visual tree with status indicators and progress tracking.

## Usage

When the user runs `/arbora:canvas`, follow these steps:

1. **Find the active draft** using `mcp__arbora__call_tool`:
   ```
   tool_name: "draft_get"
   params: {"status": "active", "tree": true}
   ```

2. **If no active draft found**, list recent drafts:
   ```
   tool_name: "draft_get"
   params: {"limit": 5}
   ```
   Ask the user which draft to display.

3. **Render to canvas** - The PostToolUse hook will automatically render the draft tree to a tmux pane when `draft_get` returns with `tree: true`.

4. **Confirm** - Let the user know the canvas is open and will auto-update as they work.

## Arguments
$ARGUMENTS

If arguments specify a draft name or ID, fetch that specific draft with `tree: true`.

## Notes

- The canvas pane appears on the right side (40% width)
- It auto-updates when tasks are completed or drafts are modified
- Use `/arbora:canvas close` to close the pane

## IMPORTANT: Do NOT call draft_get after modifications

When the canvas is open, **never** call `draft_get` after modification tools like:
- `task_add`, `task_update`, `task_delete`
- `scope_add`, `scope_update`, `scope_delete`
- `phase_add`, `phase_update`, `phase_delete`
- `draft_update`
- `diagram_add`, `diagram_update`, `diagram_delete`

The canvas **automatically updates** via optimistic updates. Calling `draft_get` is redundant and wastes API calls. Just confirm the action succeeded based on the tool response.
