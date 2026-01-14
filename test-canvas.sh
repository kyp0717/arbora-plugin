#!/usr/bin/env bash
# Test script for arbora-canvas in tmux
# Run this from within a tmux session

set -e

cd "$(dirname "$0")"

echo "Testing Arbora Canvas..."
echo

# Test 1: ASCII output (no pane)
echo "=== Test 1: ASCII Tree Output ==="
echo '{"template":"matrix","stats":{"phases":2,"scopes":2,"tasks":4},"draft":{"id":"test","project_id":"test","name":"Test Draft","description":null,"status":"active","draft_type":"feature"},"phases":[{"id":"p1","draft_id":"test","name":"Research","description":null,"status":"done","step":1,"phase_type":"research","findings":null,"scopes":[{"id":"s1","parent_id":"p1","parent_type":"phase","name":"Analysis","description":null,"scope_type":"general","status":"done","step":null,"tasks":[{"id":"t1","parent_id":"s1","parent_type":"scope","title":"Review requirements","description":null,"completed":true,"step":null},{"id":"t2","parent_id":"s1","parent_type":"scope","title":"Document findings","description":null,"completed":true,"step":null}]}]},{"id":"p2","draft_id":"test","name":"Implementation","description":null,"status":"active","step":2,"phase_type":"build","findings":null,"scopes":[{"id":"s2","parent_id":"p2","parent_type":"phase","name":"Backend","description":null,"scope_type":"backend","status":"active","step":null,"tasks":[{"id":"t3","parent_id":"s2","parent_type":"scope","title":"Create API endpoints","description":null,"completed":true,"step":null},{"id":"t4","parent_id":"s2","parent_type":"scope","title":"Add database models","description":null,"completed":false,"step":null}]}]}]}' | bun run canvas/src/cli.ts render --no-pane

echo
echo "=== Test 2: Tmux Pane (split-right 40%) ==="

if [ -z "$TMUX" ]; then
  echo "ERROR: Not in a tmux session. Run: tmux new-session"
  exit 1
fi

# Spawn canvas pane
echo '{"template":"matrix","stats":{"phases":2,"scopes":2,"tasks":4},"draft":{"id":"test","project_id":"test","name":"Arbora Canvas Test","description":"Testing canvas in tmux pane","status":"active","draft_type":"feature"},"phases":[{"id":"p1","draft_id":"test","name":"Research","description":null,"status":"done","step":1,"phase_type":"research","findings":null,"scopes":[{"id":"s1","parent_id":"p1","parent_type":"phase","name":"Analysis","description":null,"scope_type":"general","status":"done","step":null,"tasks":[{"id":"t1","parent_id":"s1","parent_type":"scope","title":"Review requirements","description":null,"completed":true,"step":null},{"id":"t2","parent_id":"s1","parent_type":"scope","title":"Document findings","description":null,"completed":true,"step":null}]}]},{"id":"p2","draft_id":"test","name":"Implementation","description":null,"status":"active","step":2,"phase_type":"build","findings":null,"scopes":[{"id":"s2","parent_id":"p2","parent_type":"phase","name":"Backend","description":null,"scope_type":"backend","status":"active","step":null,"tasks":[{"id":"t3","parent_id":"s2","parent_type":"scope","title":"Create API endpoints","description":null,"completed":true,"step":null},{"id":"t4","parent_id":"s2","parent_type":"scope","title":"Add database models","description":null,"completed":false,"step":null}]}]}]}' | bun run canvas/src/cli.ts render

echo "Canvas pane spawned! Press Enter in the pane to close it."
echo
echo "=== Test 3: Check status ==="
bun run canvas/src/cli.ts status

echo
echo "All tests passed!"
