# Arbora Plugin for Claude Code

Planning and task management with visual canvas rendering. Organize work through drafts, phases, scopes, and tasks.

## Features

- **MCP Integration**: Connects to Arbora server for persistent task management
- **Canvas App**: Native desktop window for visual draft trees with live updates
- **Optimistic Updates**: Instant UI feedback via Unix socket IPC
- **Skills**: `/arbora:canvas`, `/arbora:tree`, `/arbora:diagram`, `/arbora:doctor`
- **Hooks**: PostToolUse hooks for seamless integration

## Installation

### From Marketplace (Recommended)

```bash
claude plugins install arbora
```

This installs the plugin. You'll also want to install the canvas app:

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/arbora-plugin/main/scripts/install-canvas.sh | bash
```

### Local Development Install

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/arbora-plugin.git
   cd arbora-plugin
   ```

2. **Install canvas dependencies**
   ```bash
   cd canvas
   bun install
   cd ..
   ```

3. **Build the Go canvas app** (optional, for local development)
   ```bash
   cd canvas-go
   go build -o arbora-canvas
   cd ..
   ```

4. **Symlink to Claude plugins directory**
   ```bash
   mkdir -p ~/.claude/plugins
   ln -s $(pwd) ~/.claude/plugins/arbora
   ```

5. **Restart Claude Code** to load the plugin

### Local MCP Server (Development)

For local development with your own Arbora server, update `.claude-plugin/plugin.json`:

```json
"mcpServers": {
  "arbora": {
    "type": "http",
    "url": "http://localhost:9000/mcp"
  }
}
```

## Requirements

### Required
- **Claude Code** CLI
- **Bun** runtime (`curl -fsSL https://bun.sh/install | bash`)
- **jq** for JSON processing (`apt install jq` or `brew install jq`)
- **netcat** for socket IPC (`apt install netcat` or `brew install netcat`)

### Canvas App
- **arbora-canvas** binary (install via the script above, or build from source)

### Optional (for diagrams in CLI mode)
- **mmdc** - Mermaid CLI (`npm install -g @mermaid-js/mermaid-cli`)
- **chafa** - Terminal graphics (`apt install chafa` or `brew install chafa`)

## Usage

### Skills

| Skill | Description |
|-------|-------------|
| `/arbora:canvas` | Open draft tree in native desktop window |
| `/arbora:tree` | Display draft tree inline in terminal |
| `/arbora:diagram` | Render mermaid diagrams |
| `/arbora:doctor` | Check plugin installation and requirements |
| `/arbora:implement` | Create implementation plan for a draft |

### Example Workflow

```
You: Create a draft for implementing user auth

Claude: [Creates draft using Arbora MCP]
        [Canvas window appears showing draft tree]

You: Mark the research tasks as complete

Claude: [Updates tasks]
        [Canvas auto-updates via socket]
```

### Canvas Window Controls

- **Arrow keys / j/k**: Navigate up/down
- **Arrow keys / h/l**: Collapse/expand phases
- **Enter / o**: Open diagram viewer
- **a**: Expand all phases
- **c**: Collapse all phases
- **Escape / q**: Close diagram viewer

## Architecture

```
arbora-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest + MCP server config
├── canvas/
│   └── src/
│       ├── cli.ts           # Simplified CLI (inline output only)
│       ├── renderer/
│       │   ├── tree.ts      # ASCII tree renderer
│       │   └── diagram.ts   # Mermaid diagram renderer
│       ├── types/           # Shared TypeScript types
│       └── refresh.ts       # MCP refresh script
├── canvas-go/               # Native desktop canvas app (Go + Fyne)
│   ├── main.go              # Entry point
│   ├── ui.go                # Tree view UI components
│   ├── ipc.go               # Unix socket server
│   ├── types.go             # Data structures
│   └── go.mod
├── hooks/
│   ├── hooks.json           # Hook configuration
│   └── canvas-render.sh     # PostToolUse hook (socket IPC)
├── skills/
│   ├── canvas/SKILL.md
│   ├── tree/SKILL.md
│   ├── diagram/SKILL.md
│   └── doctor/SKILL.md
├── scripts/
│   └── install-canvas.sh    # Binary installer
└── .github/workflows/
    └── release-canvas.yml   # Multi-platform builds
```

## How It Works

1. **MCP Connection**: Plugin registers Arbora MCP server on install
2. **Tool Interception**: PostToolUse hook watches for `draft_get(tree=true)` calls
3. **Canvas Launch**: Hook launches the Tauri canvas app if not running
4. **Socket IPC**: Hook sends draft data via Unix socket at `/tmp/arbora-canvas.sock`
5. **Live Updates**: Modification tools send deltas for optimistic UI updates

```
Claude calls draft_get(tree=true)
        ↓
PostToolUse hook intercepts response
        ↓
Launch arbora-canvas if needed
        ↓
Send full state via Unix socket
        ↓
Canvas window displays draft tree

Claude calls task_update()
        ↓
PostToolUse hook extracts delta
        ↓
Send delta via Unix socket
        ↓
Canvas applies optimistic update
```

## Troubleshooting

### Run doctor to check setup

```
/arbora:doctor
```

### Canvas window not appearing

1. Check the canvas binary is installed:
   ```bash
   which arbora-canvas
   ls ~/.local/bin/arbora-canvas
   ```

2. Install if missing:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/your-org/arbora-plugin/main/scripts/install-canvas.sh | bash
   ```

3. Check debug logs:
   ```bash
   cat /tmp/arbora-hook-debug.log
   ```

### Socket connection issues

1. Check netcat is installed:
   ```bash
   which nc
   ```

2. Test socket manually (if canvas is running):
   ```bash
   echo '{"type":"command","payload":{"action":"ping"}}' | nc -U /tmp/arbora-canvas.sock
   ```

### MCP connection errors

Check the Arbora server is running and accessible:
```bash
curl https://arbora.dev/mcp  # or your local server
```

## Development

### Running canvas in dev mode

```bash
cd canvas-tauri
npm install
npm run tauri dev
```

### Testing inline rendering

```bash
cd canvas
bun run src/cli.ts render -f ../test-draft.json
```

### Building for release

```bash
cd canvas-tauri
npm run tauri build
```

Binaries will be in `canvas-tauri/src-tauri/target/release/`

## License

MIT
