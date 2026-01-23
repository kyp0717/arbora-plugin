#!/usr/bin/env bash
# PostToolUse hook for mcp__arbora__call_tool
# Starts Tauri canvas app and handles live updates with optimistic deltas via Unix socket

set -euo pipefail

SOCKET_PATH="/tmp/arbora-canvas.sock"
DRAFT_ID_FILE="/tmp/arbora-canvas-draft-id"
DEBUG_LOG="/tmp/arbora-hook-debug.log"
CANVAS_BINARY="${ARBORA_CANVAS_BIN:-arbora-canvas}"

# Debug: log that hook was called
echo "$(date): Hook called" >> "$DEBUG_LOG"

# Read hook input from stdin
INPUT=$(cat)
echo "TOOL: $(echo "$INPUT" | jq -r '.tool_input.tool_name // empty')" >> "$DEBUG_LOG"

# Extract tool_name and params from the input
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_input.tool_name // empty')
PARAMS=$(echo "$INPUT" | jq -r '.tool_input.params // empty')
TOOL_RESPONSE=$(echo "$INPUT" | jq -r '.tool_response[0].text // empty')

# Get the plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if canvas socket exists (app is running)
canvas_running() {
  [[ -S "$SOCKET_PATH" ]]
}

# Send message to canvas via Unix socket
send_to_socket() {
  local message="$1"
  if canvas_running; then
    # Use nc (netcat) to send message to Unix socket
    # -U for Unix socket, -w 1 for 1 second timeout
    echo "$message" | nc -U -w 1 "$SOCKET_PATH" 2>/dev/null || true
    echo "$(date): Sent to socket: ${message:0:100}..." >> "$DEBUG_LOG"
    return 0
  fi
  return 1
}

# Launch canvas app if not running
launch_canvas() {
  if canvas_running; then
    return 0
  fi

  echo "$(date): Launching canvas app..." >> "$DEBUG_LOG"

  # Try to find the canvas binary
  local binary=""

  # Check if ARBORA_CANVAS_BIN is set and exists
  if [[ -n "$CANVAS_BINARY" ]] && command -v "$CANVAS_BINARY" &>/dev/null; then
    binary="$CANVAS_BINARY"
  # Check common install locations
  elif [[ -x "$HOME/.local/bin/arbora-canvas" ]]; then
    binary="$HOME/.local/bin/arbora-canvas"
  elif [[ -x "/usr/local/bin/arbora-canvas" ]]; then
    binary="/usr/local/bin/arbora-canvas"
  # Check if we can run from the Go build
  elif [[ -x "$PLUGIN_ROOT/canvas-go/arbora-canvas" ]]; then
    binary="$PLUGIN_ROOT/canvas-go/arbora-canvas"
  fi

  if [[ -z "$binary" ]]; then
    echo "$(date): Canvas binary not found" >> "$DEBUG_LOG"
    return 1
  fi

  # Launch in background
  "$binary" &

  # Wait for socket to become available (max 3 seconds)
  local waited=0
  while [[ ! -S "$SOCKET_PATH" ]] && [[ $waited -lt 30 ]]; do
    sleep 0.1
    waited=$((waited + 1))
  done

  if canvas_running; then
    echo "$(date): Canvas app launched successfully" >> "$DEBUG_LOG"
    return 0
  else
    echo "$(date): Canvas app failed to start" >> "$DEBUG_LOG"
    return 1
  fi
}

# Generate a unique delta ID
generate_delta_id() {
  echo "delta_$(date +%s%N | cut -c1-16)_$$"
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

    task_create|task_add)
      # Extract created task from response
      local task=$(echo "$response" | jq -c '. | if .task then .task else {id: .id, parent_id: .parent_id, parent_type: .parent_type, title: .title, description: .description, completed: (.completed // false), step: .step} end' 2>/dev/null)
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

# Handle draft_get with tree=true - send full state to canvas
if [[ "$TOOL_NAME" == "draft_get" ]]; then
  if [[ -n "$PARAMS" ]]; then
    TREE_FLAG=$(echo "$PARAMS" | jq -r '.tree // false')
    if [[ "$TREE_FLAG" == "true" ]]; then
      if [[ -n "$TOOL_RESPONSE" ]] && [[ "$TOOL_RESPONSE" != "null" ]]; then
        # Save the draft_id for future refreshes
        DRAFT_ID=$(echo "$TOOL_RESPONSE" | jq -r '.draft.id // empty')
        if [[ -n "$DRAFT_ID" ]]; then
          echo "$DRAFT_ID" > "$DRAFT_ID_FILE"
          echo "$(date): Saved draft_id: $DRAFT_ID" >> "$DEBUG_LOG"
        fi

        # Launch canvas if not running
        launch_canvas

        # Send full state to canvas via socket
        if canvas_running; then
          MESSAGE=$(jq -c -n --argjson payload "$TOOL_RESPONSE" '{"type": "full_state", "payload": $payload}')
          send_to_socket "$MESSAGE"

          # Also show the window
          send_to_socket '{"type": "command", "payload": {"action": "show"}}'
        fi
      fi
    fi
  fi
fi

# Handle modification tools - send delta for instant UI update
MODIFY_TOOLS="task_update task_create task_add task_delete scope_update scope_create scope_add scope_delete phase_update phase_create phase_add phase_delete draft_update diagram_add diagram_update diagram_delete"

if echo "$MODIFY_TOOLS" | grep -qw "$TOOL_NAME"; then
  # Only process if canvas is running and we have a draft_id
  if canvas_running && [[ -f "$DRAFT_ID_FILE" ]]; then
    DRAFT_ID=$(cat "$DRAFT_ID_FILE" 2>/dev/null)
    if [[ -n "$DRAFT_ID" ]]; then
      # Extract and send delta for instant local update
      DELTA=$(extract_delta "$TOOL_NAME" "$PARAMS" "$TOOL_RESPONSE")
      if [[ -n "$DELTA" ]]; then
        MESSAGE=$(jq -c -n --argjson payload "$DELTA" '{"type": "delta", "payload": $payload}')
        send_to_socket "$MESSAGE"
      fi
    fi
  fi
fi

# Continue without blocking Claude
echo '{"continue": true}'
