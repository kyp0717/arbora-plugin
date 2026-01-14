import { $ } from 'bun';
import { tmpdir } from 'os';
import { join } from 'path';

const PANE_ID_FILE = join(tmpdir(), 'arbora-canvas-pane-id');
export const CONTENT_FILE = join(tmpdir(), 'arbora-canvas-data.json');

export interface PaneOptions {
  layout: 'split-right' | 'split-bottom';
  widthPercent: number;
  force?: boolean;
}

// Check if tmux is installed
export async function hasTmux(): Promise<boolean> {
  try {
    await $`which tmux`.quiet();
    return true;
  } catch {
    return false;
  }
}

// Check if we're in a tmux session
export async function inTmux(): Promise<boolean> {
  return !!process.env.TMUX && (await hasTmux());
}

// Get stored pane ID if it exists and is valid
export async function getPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(PANE_ID_FILE);
    if (!(await file.exists())) {
      return null;
    }

    const paneId = (await file.text()).trim();
    if (!paneId) {
      return null;
    }

    // Verify pane still exists
    const result = await $`tmux list-panes -F "#{pane_id}" 2>/dev/null`.text();
    const panes = result.trim().split('\n');

    if (panes.includes(paneId)) {
      return paneId;
    }

    // Pane no longer exists, clean up
    await Bun.write(PANE_ID_FILE, '');
    return null;
  } catch {
    return null;
  }
}

// Store pane ID
async function storePaneId(paneId: string): Promise<void> {
  await Bun.write(PANE_ID_FILE, paneId);
}

// Spawn a new tmux pane with content
export async function spawnPane(
  content: string,
  options: PaneOptions = { layout: 'split-right', widthPercent: 40 }
): Promise<string> {
  if (!(await inTmux()) && !options.force) {
    throw new Error('Not in a tmux session. Use --force to try anyway, or --no-pane for stdout.');
  }

  // Write content to stable file location
  await Bun.write(CONTENT_FILE, content);

  // Build tmux command based on layout
  const splitDir = options.layout === 'split-right' ? '-h' : '-v';

  // Calculate size in columns (for -h) or lines (for -v)
  const size = options.layout === 'split-right' ? 80 : 25;

  // Spawn pane with less for scrolling support
  // Use -d to NOT switch focus to the new pane (keep Claude session active)
  // less flags: -R (ANSI colors), -S (no wrap), +G (start at end), -X (no clear on exit)
  const cmd = `tmux split-window -d ${splitDir} -l ${size} -P -F "#{pane_id}" "less -R -S -X '${CONTENT_FILE}'"`;

  const proc = Bun.spawn(['bash', '-c', cmd], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  const paneId = output.trim();

  if (paneId) {
    await storePaneId(paneId);
  }

  return paneId;
}

// Update content in existing pane
export async function updatePane(paneId: string, content: string): Promise<void> {
  if (!(await inTmux())) {
    throw new Error('Not in a tmux session');
  }

  // Write content to stable file location
  await Bun.write(CONTENT_FILE, content);

  // Quit less and restart it to show new content
  await $`tmux send-keys -t ${paneId} q`.quiet();
  await $`tmux send-keys -t ${paneId} "less -R -S -X '${CONTENT_FILE}'" Enter`.quiet();
}

// Close the canvas pane
export async function closePane(paneId: string): Promise<void> {
  if (!(await inTmux())) {
    return;
  }

  try {
    await $`tmux kill-pane -t ${paneId}`.quiet();
    await Bun.write(PANE_ID_FILE, '');
  } catch {
    // Pane may already be closed
    await Bun.write(PANE_ID_FILE, '');
  }
}

// Spawn the TUI serve command in a new pane
export async function spawnServe(
  options: Omit<PaneOptions, 'force'> = { layout: 'split-right', widthPercent: 40 }
): Promise<string> {
  if (!(await inTmux())) {
    throw new Error('Not in a tmux session');
  }

  // Get the path to the CLI script
  const cliPath = join(import.meta.dir, '..', 'cli.ts');

  // Build tmux command based on layout
  const splitDir = options.layout === 'split-right' ? '-h' : '-v';
  const size = options.layout === 'split-right' ? 80 : 25;

  // Spawn pane with the serve command
  // Use -d to NOT switch focus to the new pane
  const cmd = `tmux split-window -d ${splitDir} -l ${size} -P -F "#{pane_id}" "bun run '${cliPath}' serve"`;

  const proc = Bun.spawn(['bash', '-c', cmd], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  const paneId = output.trim();

  if (paneId) {
    await storePaneId(paneId);
  }

  return paneId;
}

// Detect terminal type for image protocol support
export function detectTerminal(): 'iterm2' | 'kitty' | 'wezterm' | 'tmux' | 'unknown' {
  const termProgram = process.env.TERM_PROGRAM || process.env.LC_TERMINAL || '';

  // WezTerm supports iTerm2 protocol
  if (termProgram === 'WezTerm') {
    return 'wezterm';
  }

  // Kitty detection
  if (process.env.KITTY_WINDOW_ID) {
    return 'kitty';
  }

  // iTerm2 detection
  if (termProgram === 'iTerm.app' || termProgram.toLowerCase().includes('iterm')) {
    return 'iterm2';
  }

  // Inside tmux - check outer terminal
  if (process.env.TMUX) {
    const outerTerm = process.env.LC_TERMINAL || '';
    if (outerTerm === 'WezTerm') return 'wezterm';
    if (outerTerm.toLowerCase().includes('iterm')) return 'iterm2';
    return 'tmux';
  }

  return 'unknown';
}
