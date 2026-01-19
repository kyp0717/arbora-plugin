#!/usr/bin/env bash
# PostToolUse hook for mcp__arbora__call_tool
# Starts TUI canvas and handles live updates with optimistic deltas

set -euo pipefail

# Add bun to PATH (installed via bun.sh)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

DATA_FILE="/tmp/arbora-canvas-data.json"
DELTA_FILE="/tmp/arbora-canvas-deltas.jsonl"
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
TOOL_RESPONSE=$(echo "$INPUT" | jq -r '.tool_response[0].text // empty')

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

# Generate a unique delta ID
generate_delta_id() {
  echo "delta_$(date +%s%N | cut -c1-16)_$$"
}

# Write a delta to the delta file (instant local update)
write_delta() {
  local delta_json="$1"
  echo "$delta_json" >> "$DELTA_FILE"
  echo "$(date): Wrote delta: $delta_json" >> "$DEBUG_LOG"
}

# Background sync: refresh full draft from server (runs after delta is written)
background_sync() {
  local draft_id="$1"
  if [[ -z "$draft_id" ]]; then
    return 1
  fi

  # Small delay to let server process the update
  sleep 0.5

  REFRESH_SCRIPT="$PLUGIN_ROOT/canvas/src/refresh.ts"
  if [[ -f "$REFRESH_SCRIPT" ]]; then
    (cd "$PLUGIN_ROOT/canvas" && bun run src/refresh.ts "$draft_id" >> "$DEBUG_LOG" 2>&1)
  fi
}

# Extract delta from tool call and response
extract_delta() {
  local tool="$1"
  local params="$2"
  local response="$3"
  local delta_id=$(generate_delta_id)
  local timestamp=$(date +%s%3N)

  case "$tool" in
    task_update)
      local task_id=$(echo "$params" | jq -r '.id // empty')
      local patch=$(echo "$params" | jq -c 'del(.id)')
      if [[ -n "$task_id" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"task_update\",\"taskId\":\"$task_id\",\"patch\":$patch}"
      fi
      ;;

    task_create)
      # Extract created task from response
      local task=$(echo "$response" | jq -c '.task // empty' 2>/dev/null)
      if [[ -n "$task" ]] && [[ "$task" != "null" ]] && [[ "$task" != "" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"task_create\",\"task\":$task}"
      fi
      ;;

    task_delete)
      local task_id=$(echo "$params" | jq -r '.id // empty')
      if [[ -n "$task_id" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"task_delete\",\"taskId\":\"$task_id\"}"
      fi
      ;;

    scope_update)
      local scope_id=$(echo "$params" | jq -r '.id // empty')
      local patch=$(echo "$params" | jq -c 'del(.id)')
      if [[ -n "$scope_id" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"scope_update\",\"scopeId\":\"$scope_id\",\"patch\":$patch}"
      fi
      ;;

    scope_create)
      local scope=$(echo "$response" | jq -c '.scope // empty' 2>/dev/null)
      if [[ -n "$scope" ]] && [[ "$scope" != "null" ]] && [[ "$scope" != "" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"scope_create\",\"scope\":$scope}"
      fi
      ;;

    scope_delete)
      local scope_id=$(echo "$params" | jq -r '.id // empty')
      if [[ -n "$scope_id" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"scope_delete\",\"scopeId\":\"$scope_id\"}"
      fi
      ;;

    phase_update)
      local phase_id=$(echo "$params" | jq -r '.id // empty')
      local patch=$(echo "$params" | jq -c 'del(.id)')
      if [[ -n "$phase_id" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"phase_update\",\"phaseId\":\"$phase_id\",\"patch\":$patch}"
      fi
      ;;

    phase_create)
      local phase=$(echo "$response" | jq -c '.phase // empty' 2>/dev/null)
      if [[ -n "$phase" ]] && [[ "$phase" != "null" ]] && [[ "$phase" != "" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"phase_create\",\"phase\":$phase}"
      fi
      ;;

    phase_delete)
      local phase_id=$(echo "$params" | jq -r '.id // empty')
      if [[ -n "$phase_id" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"phase_delete\",\"phaseId\":\"$phase_id\"}"
      fi
      ;;

    draft_update)
      local patch=$(echo "$params" | jq -c 'del(.id)')
      echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"draft_update\",\"patch\":$patch}"
      ;;

    diagram_add)
      local phase_id=$(echo "$params" | jq -r '.phase_id // empty')
      local diagram=$(echo "$params" | jq -c '{name: .name, type: .type, content: .content}')
      if [[ -n "$phase_id" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"diagram_add\",\"phaseId\":\"$phase_id\",\"diagram\":$diagram}"
      fi
      ;;

    diagram_update)
      local phase_id=$(echo "$params" | jq -r '.phase_id // empty')
      local diagram_name=$(echo "$params" | jq -r '.name // empty')
      local patch=$(echo "$params" | jq -c 'del(.phase_id, .name) | with_entries(select(.value != null))')
      if [[ -n "$phase_id" ]] && [[ -n "$diagram_name" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"diagram_update\",\"phaseId\":\"$phase_id\",\"diagramName\":\"$diagram_name\",\"patch\":$patch}"
      fi
      ;;

    diagram_delete)
      local phase_id=$(echo "$params" | jq -r '.phase_id // empty')
      local diagram_name=$(echo "$params" | jq -r '.name // empty')
      if [[ -n "$phase_id" ]] && [[ -n "$diagram_name" ]]; then
        echo "{\"id\":\"$delta_id\",\"timestamp\":$timestamp,\"action\":\"diagram_delete\",\"phaseId\":\"$phase_id\",\"diagramName\":\"$diagram_name\"}"
      fi
      ;;
  esac
}

# Handle draft_get with tree=true - write data, save draft_id, start TUI
if [[ "$TOOL_NAME" == "draft_get" ]]; then
  if [[ -n "$PARAMS" ]]; then
    TREE_FLAG=$(echo "$PARAMS" | jq -r '.tree // false')
    if [[ "$TREE_FLAG" == "true" ]]; then
      if [[ -n "$TOOL_RESPONSE" ]] && [[ "$TOOL_RESPONSE" != "null" ]]; then
        # Write draft data to file (TUI will pick it up)
        echo "$TOOL_RESPONSE" > "$DATA_FILE"

        # Clear any pending deltas since we have fresh data
        > "$DELTA_FILE"

        # Save the draft_id for future refreshes
        DRAFT_ID=$(echo "$TOOL_RESPONSE" | jq -r '.draft.id // empty')
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

# Handle modification tools - write delta for instant UI update, then background sync
MODIFY_TOOLS="task_update task_create task_delete scope_update scope_create scope_delete phase_update phase_create phase_delete draft_update diagram_add diagram_update diagram_delete"

if echo "$MODIFY_TOOLS" | grep -qw "$TOOL_NAME"; then
  # Only process if canvas pane exists and we have a draft_id
  if pane_exists && [[ -f "$DRAFT_ID_FILE" ]]; then
    DRAFT_ID=$(cat "$DRAFT_ID_FILE" 2>/dev/null)
    if [[ -n "$DRAFT_ID" ]]; then
      # Extract and write delta for instant local update
      DELTA=$(extract_delta "$TOOL_NAME" "$PARAMS" "$TOOL_RESPONSE")
      if [[ -n "$DELTA" ]]; then
        write_delta "$DELTA"
      fi

      # Background sync to verify with server (non-blocking)
      (background_sync "$DRAFT_ID") &
    fi
  fi
fi

# Continue without blocking Claude
echo '{"continue": true}'
