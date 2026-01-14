#!/usr/bin/env bash
# PostToolUse hook for mcp__arbora__call_tool
# Starts TUI canvas and handles live updates

set -euo pipefail

DATA_FILE="/tmp/arbora-canvas-data.json"
PANE_ID_FILE="/tmp/arbora-canvas-pane-id"
DRAFT_ID_FILE="/tmp/arbora-canvas-draft-id"
DEBUG_LOG="/tmp/arbora-hook-debug.log"

# Debug: log that hook was called
echo "$(date): Hook called" >> "$DEBUG_LOG"

# Read hook input from stdin
INPUT=$(cat)
echo "TOOL: $(echo "$INPUT" | jq -r '.tool_input.tool_name // empty')" >> "$DEBUG_LOG"

# Extract tool_name and params from the input
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_input.tool_name // empty')
PARAMS=$(echo "$INPUT" | jq -r '.tool_input.params // empty')

# Check if tmux is available (don't rely on $TMUX env var - Claude Code may not inherit it)
if ! command -v tmux &>/dev/null || ! tmux list-panes &>/dev/null; then
  echo '{"continue": true}'
  exit 0
fi

# Get the plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if canvas pane exists and is running
pane_exists() {
  if [[ -f "$PANE_ID_FILE" ]]; then
    local pane_id=$(cat "$PANE_ID_FILE" 2>/dev/null)
    if [[ -n "$pane_id" ]]; then
      tmux list-panes -F "#{pane_id}" 2>/dev/null | grep -q "^${pane_id}$" && return 0
    fi
  fi
  return 1
}

# Refresh draft data by calling arbora API via TypeScript helper
refresh_draft() {
  local draft_id="$1"
  if [[ -z "$draft_id" ]]; then
    return 1
  fi

  echo "$(date): Refreshing draft $draft_id" >> "$DEBUG_LOG"

  # Use TypeScript helper script that handles MCP protocol
  REFRESH_SCRIPT="$PLUGIN_ROOT/canvas/src/refresh.ts"
  if [[ -f "$REFRESH_SCRIPT" ]]; then
    (cd "$PLUGIN_ROOT/canvas" && bun run src/refresh.ts "$draft_id" >> "$DEBUG_LOG" 2>&1)
    return $?
  else
    echo "$(date): Refresh script not found: $REFRESH_SCRIPT" >> "$DEBUG_LOG"
    return 1
  fi
}

# Handle draft_get with tree=true - write data, save draft_id, start TUI
if [[ "$TOOL_NAME" == "draft_get" ]]; then
  if [[ -n "$PARAMS" ]]; then
    TREE_FLAG=$(echo "$PARAMS" | jq -r '.tree // false')
    if [[ "$TREE_FLAG" == "true" ]]; then
      # Claude sends tool_response as array with text field
      TOOL_OUTPUT=$(echo "$INPUT" | jq -r '.tool_response[0].text // empty')
      if [[ -n "$TOOL_OUTPUT" ]] && [[ "$TOOL_OUTPUT" != "null" ]]; then
        # Write draft data to file (TUI will pick it up)
        echo "$TOOL_OUTPUT" > "$DATA_FILE"

        # Save the draft_id for future refreshes
        DRAFT_ID=$(echo "$TOOL_OUTPUT" | jq -r '.draft.id // empty')
        if [[ -n "$DRAFT_ID" ]]; then
          echo "$DRAFT_ID" > "$DRAFT_ID_FILE"
          echo "$(date): Saved draft_id: $DRAFT_ID" >> "$DEBUG_LOG"
        fi

        # Start TUI pane if not already running
        if ! pane_exists; then
          CANVAS_DIR="$PLUGIN_ROOT/canvas"
          (cd "$CANVAS_DIR" && bun run src/cli.ts start >> "$DEBUG_LOG" 2>&1) &
        fi
      fi
    fi
  fi
fi

# Handle modification tools - refresh the canvas after changes
# List of tools that modify draft data
MODIFY_TOOLS="task_update task_create task_delete scope_update scope_create scope_delete phase_update phase_create phase_delete draft_update diagram_add diagram_update diagram_delete"

if echo "$MODIFY_TOOLS" | grep -qw "$TOOL_NAME"; then
  # Only refresh if canvas pane exists and we have a draft_id
  if pane_exists && [[ -f "$DRAFT_ID_FILE" ]]; then
    DRAFT_ID=$(cat "$DRAFT_ID_FILE" 2>/dev/null)
    if [[ -n "$DRAFT_ID" ]]; then
      # Refresh in background to not block Claude
      (refresh_draft "$DRAFT_ID") &
    fi
  fi
fi

# Continue without blocking Claude
echo '{"continue": true}'
