#!/usr/bin/env bash
# PostToolUse hook for mcp__arbora__call_tool
# Starts TUI canvas and handles live updates

set -euo pipefail

DATA_FILE="/tmp/arbora-canvas-data.json"
PANE_ID_FILE="/tmp/arbora-canvas-pane-id"

# Read hook input from stdin
INPUT=$(cat)

# Extract tool_name and params from the input
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_input.tool_name // empty')
PARAMS=$(echo "$INPUT" | jq -r '.tool_input.params // empty')

# Check if we're in tmux
if [[ -z "${TMUX:-}" ]] || ! command -v tmux &>/dev/null; then
  echo '{"continue": true}'
  exit 0
fi

# Get the plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
CANVAS_CLI="$PLUGIN_ROOT/canvas/src/cli.ts"

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

# Handle draft_get with tree=true - write data and start TUI if needed
if [[ "$TOOL_NAME" == "draft_get" ]]; then
  if [[ -n "$PARAMS" ]]; then
    TREE_FLAG=$(echo "$PARAMS" | jq -r '.tree // false')
    if [[ "$TREE_FLAG" == "true" ]]; then
      TOOL_OUTPUT=$(echo "$INPUT" | jq -r '.tool_output // empty')
      if [[ -n "$TOOL_OUTPUT" ]] && [[ "$TOOL_OUTPUT" != "null" ]]; then
        # Write draft data to file (TUI will pick it up)
        echo "$TOOL_OUTPUT" > "$DATA_FILE"

        # Start TUI pane if not already running
        if ! pane_exists; then
          bun run "$CANVAS_CLI" start &>/dev/null &
        fi
      fi
    fi
  fi
fi

# Continue without blocking Claude
echo '{"continue": true}'
