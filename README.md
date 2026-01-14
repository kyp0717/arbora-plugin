# Arbora Plugin for Claude Code

Planning and task management with visual canvas rendering. Organize work through drafts, phases, scopes, and tasks.

## Features

- **MCP Integration**: Connects to Arbora server for persistent task management
- **Canvas Rendering**: Visual draft trees in tmux side panes
- **Auto-refresh**: Canvas updates automatically as you work
- **Skills**: `/arbora:canvas`, `/arbora:tree`, `/arbora:diagram`
- **Hooks**: PostToolUse hooks for seamless integration

## Installation

### From Marketplace (Recommended)

```bash
claude plugins install arbora
```

This installs everything - no additional configuration needed.

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

3. **Symlink to Claude plugins directory**
   ```bash
   mkdir -p ~/.claude/plugins
   ln -s $(pwd) ~/.claude/plugins/arbora
   ```

4. **Restart Claude Code** to load the plugin

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

### Recommended
- **tmux** - For canvas side pane (`apt install tmux` or `brew install tmux`)

### Optional (for diagrams)
- **mmdc** - Mermaid CLI (`npm install -g @mermaid-js/mermaid-cli`)
- **chafa** - Terminal graphics (`apt install chafa` or `brew install chafa`)

## Usage

### Start Claude Code in tmux

For the best experience with canvas panes:

```bash
tmux new-session -s work
cd /your/project
claude
```

### Skills

| Skill | Description |
|-------|-------------|
| `/arbora:canvas` | Open draft tree in tmux side pane |
| `/arbora:tree` | Display draft tree inline (no pane) |
| `/arbora:diagram` | Render mermaid diagrams |
| `/arbora:draft` | Create or view drafts |

### Example Workflow

```
You: Create a draft for implementing user auth

Claude: [Creates draft using Arbora MCP]
        [Canvas pane appears showing draft tree]

You: Mark the research tasks as complete

Claude: [Updates tasks]
        [Canvas auto-refreshes]
```

## Architecture

```
arbora-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest + MCP server config
├── canvas/
│   ├── src/
│   │   ├── cli.ts           # Canvas CLI entry point
│   │   ├── renderer/
│   │   │   ├── tree.ts      # ASCII tree renderer
│   │   │   └── diagram.ts   # Mermaid diagram renderer
│   │   └── terminal/
│   │       └── tmux.ts      # Tmux pane management
│   └── package.json
├── hooks/
│   ├── hooks.json           # Hook configuration
│   └── canvas-render.sh     # PostToolUse hook
├── skills/
│   ├── canvas/SKILL.md
│   ├── tree/SKILL.md
│   └── diagram/SKILL.md
└── commands/
    └── draft.md
```

## How It Works

1. **MCP Connection**: Plugin registers Arbora MCP server on install
2. **Tool Interception**: PostToolUse hook watches for `draft_get(tree=true)` calls
3. **Canvas Render**: Hook triggers `canvas/src/cli.ts` to render draft tree
4. **Tmux Pane**: Canvas spawns/updates a tmux side pane (or falls back to stdout)

```
Claude calls draft_get(tree=true)
        ↓
PostToolUse hook intercepts response
        ↓
canvas CLI renders ASCII tree
        ↓
tmux split-window displays canvas
```

## Configuration

### Canvas Layout

The canvas pane defaults to:
- Position: Right side (`split-right`)
- Width: 60 columns

### Without tmux

If tmux is not available, the canvas outputs inline to stdout with a note:
```
[tmux not installed - outputting to stdout]
```

## Troubleshooting

### Canvas pane not appearing

1. Ensure you're running Claude Code **inside** a tmux session:
   ```bash
   echo $TMUX  # Should show tmux socket path
   ```

2. Check tmux is installed:
   ```bash
   which tmux
   ```

3. Test canvas manually:
   ```bash
   cd ~/.claude/plugins/arbora
   ./debug-tmux.sh
   ```

### Mermaid diagrams not rendering

Install required tools:
```bash
npm install -g @mermaid-js/mermaid-cli
apt install chafa  # or: brew install chafa
```

### MCP connection errors

Check the Arbora server is running and accessible:
```bash
curl https://arbora.dev/mcp  # or your local server
```

## Development

### Testing canvas locally

```bash
cd /path/to/arbora-plugin
bun run canvas/src/cli.ts render -f test-draft.json
```

### Testing without tmux

```bash
bun run canvas/src/cli.ts render --no-pane -f test-draft.json
```

## License

MIT
