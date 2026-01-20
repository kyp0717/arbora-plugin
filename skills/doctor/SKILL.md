---
name: doctor
description: Check if arbora plugin is installed correctly and verify requirements
allowed-tools:
  - Bash
  - mcp__arbora__call_tool
---

# Doctor Skill

Diagnoses the arbora plugin installation and verifies all requirements are met.

## Usage

When the user runs `/arbora:doctor` or asks "is arbora working?":

Run these checks in order and report results:

### 1. Check Bun Installation
```bash
command -v bun && bun --version
```
- ✓ Pass: bun found with version
- ✗ Fail: "bun not found. Install: curl -fsSL https://bun.sh/install | bash"

### 2. Check Tmux Installation
```bash
command -v tmux && tmux -V
```
- ✓ Pass: tmux found with version
- ✗ Fail: "tmux not found. Install: apt install tmux (or brew install tmux)"

### 3. Check Tmux Session
```bash
tmux list-panes 2>/dev/null
```
- ✓ Pass: Running inside tmux
- ⚠ Warn: "Not in tmux session. Canvas pane requires tmux. Run: tmux"

### 4. Check Tmux Configuration
```bash
tmux show-options -g mouse 2>/dev/null
tmux show-options -g history-limit 2>/dev/null
tmux show-options -g mode-keys 2>/dev/null
```

Required settings for best experience:
| Setting | Recommended | Purpose |
|---------|-------------|---------|
| `mouse` | `on` | Mouse support for scrolling/clicking |
| `history-limit` | `10000+` | Scroll buffer size |
| `mode-keys` | `vi` or `emacs` | Keyboard navigation in copy mode |

- ✓ Pass: All recommended settings configured
- ⚠ Warn: Show missing settings and how to fix

**If tmux config is missing or incomplete, suggest adding to `~/.tmux.conf`:**
```bash
# Mouse support
set -g mouse on

# Increase scroll buffer
set -g history-limit 50000

# Vi mode for copy/navigation
setw -g mode-keys vi

# Better colors
set -g default-terminal "screen-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# Don't rename windows automatically
set -g allow-rename off

# Start windows/panes at 1 instead of 0
set -g base-index 1
setw -g pane-base-index 1

# Faster escape time (better for vim)
set -sg escape-time 10

# Enable focus events (for vim autoread)
set -g focus-events on
```

### 5. Check MCP Server Connection
```
tool_name: "project_list"
params: {}
```
- ✓ Pass: Server responds with project list
- ✗ Fail: "Cannot connect to arbora server. Check if server is running."

### 6. Check Canvas Dependencies
```bash
ls ${CLAUDE_PLUGIN_ROOT}/canvas/node_modules/ink 2>/dev/null
```
- ✓ Pass: Dependencies installed
- ✗ Fail: "Canvas dependencies missing. Run: cd <plugin>/canvas && bun install"

### 7. Check Hook Configuration
```bash
cat ${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json
```
- ✓ Pass: hooks.json exists and contains PostToolUse
- ✗ Fail: "Hook configuration missing or invalid"

## Output Format

```
🔍 Arbora Plugin Diagnostics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Bun             v1.1.38
✓ Tmux            v3.4
✓ Tmux Session    active
✓ Tmux Config     mouse=on, history=50000, mode-keys=vi
✓ MCP Server      connected (arbora.dev)
✓ Canvas Deps     installed
✓ Hooks           configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: All checks passed ✓
```

Or with issues:

```
🔍 Arbora Plugin Diagnostics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Bun             v1.1.38
✓ Tmux            v3.4
✗ Tmux Session    not active
⚠ Tmux Config     mouse=off (should be on)
✓ MCP Server      connected
✗ Canvas Deps     missing
✓ Hooks           configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 2 errors, 1 warning

Fixes needed:
1. Start tmux: tmux
2. Install deps: cd /path/to/plugin/canvas && bun install
3. Add to ~/.tmux.conf: set -g mouse on
```

## Arguments
$ARGUMENTS

- `--fix`: Attempt to auto-fix issues (install deps, configure tmux, etc.)
- `--quiet`: Only show failures

## Auto-Fix Behavior (--fix)

When `--fix` is specified:

1. **Missing bun**: Offer to run `curl -fsSL https://bun.sh/install | bash`

2. **Missing canvas deps**: Run `cd <plugin>/canvas && bun install`

3. **Tmux config issues**: Append missing settings to `~/.tmux.conf`:
   ```bash
   echo 'set -g mouse on' >> ~/.tmux.conf
   tmux source-file ~/.tmux.conf  # Reload without restart
   ```

4. **Not in tmux**: Cannot auto-fix, user must start tmux manually

Always ask for confirmation before making changes.
