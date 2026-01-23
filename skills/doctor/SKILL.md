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
- Pass: bun found with version
- Fail: "bun not found. Install: curl -fsSL https://bun.sh/install | bash"

### 2. Check Canvas Binary
```bash
command -v arbora-canvas || ls ~/.local/bin/arbora-canvas 2>/dev/null || ls /usr/local/bin/arbora-canvas 2>/dev/null
```
- Pass: arbora-canvas binary found
- Fail: "Canvas binary not found. Install: curl -fsSL https://raw.githubusercontent.com/your-org/arbora-plugin/main/scripts/install-canvas.sh | bash"

### 3. Check MCP Server Connection
```
tool_name: "project_list"
params: {}
```
- Pass: Server responds with project list
- Fail: "Cannot connect to arbora server. Check if server is running."

### 4. Check Netcat (for socket IPC)
```bash
command -v nc && nc -h 2>&1 | head -1
```
- Pass: netcat available
- Warn: "netcat (nc) not found. Canvas updates may not work. Install: apt install netcat (or brew install netcat)"

### 5. Check Hook Configuration
```bash
cat ${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json
```
- Pass: hooks.json exists and contains PostToolUse
- Fail: "Hook configuration missing or invalid"

### 6. Check jq Installation (for hooks)
```bash
command -v jq && jq --version
```
- Pass: jq found
- Fail: "jq not found. Install: apt install jq (or brew install jq)"

## Output Format

```
Arbora Plugin Diagnostics

* Bun             v1.1.38
* Canvas Binary   ~/.local/bin/arbora-canvas
* MCP Server      connected (arbora.dev)
* Netcat          available
* Hooks           configured
* jq              v1.7

Status: All checks passed
```

Or with issues:

```
Arbora Plugin Diagnostics

* Bun             v1.1.38
x Canvas Binary   not found
* MCP Server      connected
! Netcat          not found
* Hooks           configured
* jq              v1.7

Status: 1 error, 1 warning

Fixes needed:
1. Install canvas: curl -fsSL .../scripts/install-canvas.sh | bash
2. Install netcat: apt install netcat
```

## Arguments
$ARGUMENTS

- `--fix`: Attempt to auto-fix issues (install deps, etc.)
- `--quiet`: Only show failures

## Auto-Fix Behavior (--fix)

When `--fix` is specified:

1. **Missing bun**: Offer to run `curl -fsSL https://bun.sh/install | bash`

2. **Missing canvas binary**: Run the install script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/your-org/arbora-plugin/main/scripts/install-canvas.sh | bash
   ```

3. **Missing jq**: Offer to install via package manager

4. **Missing netcat**: Offer to install via package manager

Always ask for confirmation before making changes.
