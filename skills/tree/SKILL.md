---
name: tree
description: Display draft tree as ASCII art inline (no tmux pane)
allowed-tools:
  - mcp__arbora__call_tool
  - Bash
---

# Tree Skill

Displays the draft tree as ASCII art directly in the conversation, without opening a separate tmux pane.

## Usage

When the user runs `/arbora:tree`, follow these steps:

1. **Find the target draft**:
   - If arguments provided, search for that draft by name/ID
   - Otherwise, get the active draft or list recent drafts

2. **Fetch with tree structure**:
   ```
   tool_name: "draft_get"
   params: {"id": "<draft_id>", "tree": true}
   ```

3. **Render inline** using the canvas CLI with `--no-pane`:
   ```bash
   echo '<draft_json>' | bun run ${CLAUDE_PLUGIN_ROOT}/canvas/src/cli.ts render --no-pane
   ```

4. **Display** the ASCII tree output to the user.

## Arguments
$ARGUMENTS

## Example Output

```
📋 My Feature [feature] active
│
├─ ○ Research (research)
│  └─ 📁 Backend (backend)
│     ├─ [✓] Review existing code
│     └─ [ ] Document findings
│
└─ ○ Design (design)
   └─ 📁 Architecture (general)
      └─ [ ] Create system diagram

──────────────────────────────────────────────────
📊 2 phases, 2 scopes, 3 tasks
Progress: ███████░░░░░░░░░░░░░ 33%
```
