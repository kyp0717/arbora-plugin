import { tmpdir } from 'os';
import { join } from 'path';

const DEBOUNCE_FILE = join(tmpdir(), 'arbora-canvas-debounce');
const DEBOUNCE_MS = 500;

// Check if we should debounce (return true if too soon since last call)
export async function shouldDebounce(): Promise<boolean> {
  const file = Bun.file(DEBOUNCE_FILE);

  try {
    if (await file.exists()) {
      const lastTime = parseInt(await file.text(), 10);
      const now = Date.now();

      if (now - lastTime < DEBOUNCE_MS) {
        return true;
      }
    }
  } catch {
    // Ignore errors, proceed without debounce
  }

  // Update timestamp
  await Bun.write(DEBOUNCE_FILE, String(Date.now()));
  return false;
}

// Reset debounce timer
export async function resetDebounce(): Promise<void> {
  await Bun.write(DEBOUNCE_FILE, '0');
}
