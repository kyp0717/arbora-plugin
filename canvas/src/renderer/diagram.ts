import { $ } from 'bun';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectTerminal } from '../terminal/tmux.js';
import type { Diagram } from '../types/index.js';

// Dark theme configuration for mermaid diagrams
const DARK_THEME_INIT = `%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#1e1e2e', 'primaryTextColor': '#cdd6f4', 'primaryBorderColor': '#45475a', 'lineColor': '#6c7086', 'secondaryColor': '#313244', 'tertiaryColor': '#45475a', 'background': '#11111b', 'nodeBorder': '#45475a', 'clusterBkg': '#1e1e2e', 'clusterBorder': '#45475a', 'titleColor': '#cdd6f4'}}}%%`;

// Color classes for node styling
const COLOR_CLASSES = `
    classDef purple fill:#8b5cf6,stroke:#7c3aed,color:#fff
    classDef green fill:#10b981,stroke:#059669,color:#fff
    classDef blue fill:#3b82f6,stroke:#2563eb,color:#fff
    classDef orange fill:#f97316,stroke:#ea580c,color:#fff
    classDef pink fill:#ec4899,stroke:#db2777,color:#fff
    classDef red fill:#ef4444,stroke:#dc2626,color:#fff
    classDef yellow fill:#eab308,stroke:#ca8a04,color:#1e1e2e
    classDef gray fill:#374151,stroke:#4b5563,color:#9ca3af
    classDef cyan fill:#06b6d4,stroke:#0891b2,color:#fff`;

// Inject dark theme into mermaid content if not already present
function injectDarkTheme(content: string): string {
  // Skip if diagram already has an init block
  if (content.includes('%%{init:')) {
    return content;
  }

  // Find the graph/flowchart declaration line
  const lines = content.split('\n');
  const graphLineIndex = lines.findIndex(line =>
    /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)\b/i.test(line)
  );

  if (graphLineIndex === -1) {
    // No graph declaration found, prepend theme anyway
    return `${DARK_THEME_INIT}\n${content}`;
  }

  // Insert theme before graph declaration, and color classes after
  const beforeGraph = lines.slice(0, graphLineIndex);
  const graphLine = lines[graphLineIndex];
  const afterGraph = lines.slice(graphLineIndex + 1);

  // Only add color classes for graph/flowchart types
  const needsColorClasses = /^\s*(graph|flowchart)\b/i.test(graphLine);

  if (needsColorClasses) {
    return [
      ...beforeGraph,
      DARK_THEME_INIT,
      graphLine,
      COLOR_CLASSES,
      ...afterGraph
    ].join('\n');
  }

  return [
    ...beforeGraph,
    DARK_THEME_INIT,
    graphLine,
    ...afterGraph
  ].join('\n');
}

// Check if a command exists
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await $`which ${cmd}`.quiet();
    return true;
  } catch {
    return false;
  }
}

// Render mermaid to PNG using mmdc
async function mermaidToPng(content: string, outputPath: string): Promise<boolean> {
  if (!(await commandExists('mmdc'))) {
    console.error('mmdc (mermaid-cli) not found. Install with: npm install -g @mermaid-js/mermaid-cli');
    return false;
  }

  // Inject dark theme if not already present
  const themedContent = injectDarkTheme(content);

  const inputFile = join(tmpdir(), `arbora-mermaid-${Date.now()}.mmd`);
  await Bun.write(inputFile, themedContent);

  try {
    // Use --puppeteer-config to disable sandbox on Linux (required for Ubuntu 23.10+)
    const puppeteerConfig = join(tmpdir(), 'puppeteer-config.json');
    await Bun.write(puppeteerConfig, JSON.stringify({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }));

    await $`mmdc -i ${inputFile} -o ${outputPath} -b transparent -t dark -p ${puppeteerConfig}`.quiet();
    return true;
  } catch (error) {
    console.error('Failed to render mermaid diagram:', error);
    return false;
  }
}

// Display image using chafa (universal fallback)
async function displayWithChafa(imagePath: string, width: number = 80): Promise<string> {
  if (!(await commandExists('chafa'))) {
    return '[chafa not found - install with: apt install chafa or brew install chafa]';
  }

  try {
    const result = await $`chafa --size ${width}x --colors 256 ${imagePath}`.text();
    return result;
  } catch {
    return '[Failed to display image with chafa]';
  }
}

// Display image using Kitty graphics protocol
async function displayWithKitty(imagePath: string): Promise<string> {
  try {
    // Kitty uses escape sequences for inline images
    const imageData = await Bun.file(imagePath).arrayBuffer();
    const base64 = Buffer.from(imageData).toString('base64');

    // Kitty protocol: ESC_G ... ESC_\
    // a=T means transmit and display, f=100 means PNG format
    const chunks: string[] = [];
    const chunkSize = 4096;

    for (let i = 0; i < base64.length; i += chunkSize) {
      const chunk = base64.slice(i, i + chunkSize);
      const isLast = i + chunkSize >= base64.length;
      const more = isLast ? 0 : 1;

      if (i === 0) {
        chunks.push(`\x1b_Ga=T,f=100,m=${more};${chunk}\x1b\\`);
      } else {
        chunks.push(`\x1b_Gm=${more};${chunk}\x1b\\`);
      }
    }

    return chunks.join('');
  } catch {
    return displayWithChafa(imagePath);
  }
}

// Display image using iTerm2 protocol
async function displayWithIterm2(imagePath: string): Promise<string> {
  try {
    const imageData = await Bun.file(imagePath).arrayBuffer();
    const base64 = Buffer.from(imageData).toString('base64');

    // iTerm2 inline image protocol
    return `\x1b]1337;File=inline=1:${base64}\x07`;
  } catch {
    return displayWithChafa(imagePath);
  }
}

// Main function to render a diagram
export async function renderDiagram(diagram: Diagram, width: number = 80): Promise<string> {
  const outputPath = join(tmpdir(), `arbora-diagram-${Date.now()}.png`);

  // Render mermaid to PNG
  const success = await mermaidToPng(diagram.content, outputPath);
  if (!success) {
    // Fallback: return the raw mermaid source in a code block
    return `\n[Diagram: ${diagram.name}]\n\`\`\`mermaid\n${diagram.content}\n\`\`\`\n`;
  }

  // Display based on terminal type
  const terminal = detectTerminal();
  let output: string;

  switch (terminal) {
    case 'kitty':
      output = await displayWithKitty(outputPath);
      break;
    case 'iterm2':
    case 'wezterm':  // WezTerm supports iTerm2 protocol
      output = await displayWithIterm2(outputPath);
      break;
    default:
      output = await displayWithChafa(outputPath, width);
  }

  // Clean up temp file
  try {
    await Bun.file(outputPath).exists() && (await $`rm ${outputPath}`.quiet());
  } catch {
    // Ignore cleanup errors
  }

  return `\n[${diagram.name}] (${diagram.type})\n${output}`;
}

// Render all diagrams from a phase or draft
export async function renderDiagrams(diagrams: Diagram[], width: number = 80): Promise<string> {
  if (!diagrams || diagrams.length === 0) {
    return '';
  }

  const outputs: string[] = [];
  for (const diagram of diagrams) {
    const rendered = await renderDiagram(diagram, width);
    outputs.push(rendered);
  }

  return outputs.join('\n');
}
