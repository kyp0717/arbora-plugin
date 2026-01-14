#!/usr/bin/env bash
# Debug script for tmux pane spawning

echo "=== Tmux Debug ==="
echo "TMUX env: ${TMUX:-not set}"
echo "tmux path: $(which tmux)"

if [[ -z "$TMUX" ]]; then
  echo "ERROR: Not in a tmux session!"
  echo "Run: tmux new-session -s test"
  exit 1
fi

echo ""
echo "=== Testing tmux split-window ==="

# Create test content
CONTENT_FILE="/tmp/arbora-test-content.txt"
cat > "$CONTENT_FILE" << 'EOF'
📋 Test Draft [chore] active
│
├─ [✓] Task one
└─ [ ] Task two

──────────────────────────────────────────────────
📊 2 tasks
Progress: ██████████░░░░░░░░░░ 50%

Press q to close this pane.
EOF

echo "Content file: $CONTENT_FILE"
cat "$CONTENT_FILE"
echo ""

echo "=== Spawning pane... ==="
# Use -l for size (columns for -h, lines for -v)
PANE_ID=$(tmux split-window -h -l 60 -P -F "#{pane_id}" "less -R '$CONTENT_FILE'")
echo "Pane ID: $PANE_ID"

if [[ -n "$PANE_ID" ]]; then
  echo "SUCCESS: Pane spawned!"
  echo "$PANE_ID" > /tmp/arbora-canvas-pane-id
else
  echo "FAILED: No pane ID returned"
fi
