import chalk from 'chalk';
import type { DraftTree, Phase, Scope, Task, DraftStatus } from '../types/index.js';

// Box drawing characters
const BOX = {
  vertical: '│',
  horizontal: '─',
  corner: '└',
  tee: '├',
  blank: ' ',
};

// Status colors
function statusColor(status: DraftStatus): (text: string) => string {
  switch (status) {
    case 'done':
      return chalk.green;
    case 'active':
      return chalk.yellow;
    case 'blocked':
      return chalk.red;
    case 'queued':
    default:
      return chalk.gray;
  }
}

// Status indicators
function statusIndicator(status: DraftStatus): string {
  switch (status) {
    case 'done':
      return chalk.green('✓');
    case 'active':
      return chalk.yellow('●');
    case 'blocked':
      return chalk.red('✗');
    case 'queued':
    default:
      return chalk.gray('○');
  }
}

// Task checkbox
function taskCheckbox(completed: boolean): string {
  return completed ? chalk.green('[✓]') : chalk.gray('[ ]');
}

// Calculate completion stats
function calculateCompletion(tasks: Task[]): { completed: number; total: number } {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return { completed, total };
}

// Progress bar
function progressBar(completed: number, total: number, width: number = 20): string {
  if (total === 0) return chalk.gray('─'.repeat(width));
  const percent = completed / total;
  const filled = Math.round(percent * width);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const pct = Math.round(percent * 100);
  return `${bar} ${pct}%`;
}

// Render a single task
function renderTask(task: Task, prefix: string, isLast: boolean): string {
  const connector = isLast ? BOX.corner : BOX.tee;
  const checkbox = taskCheckbox(task.completed);
  const title = task.completed ? chalk.gray(task.title) : task.title;
  return `${prefix}${connector}${BOX.horizontal} ${checkbox} ${title}`;
}

// Render a scope with its tasks
function renderScope(scope: Scope, prefix: string, isLast: boolean): string[] {
  const lines: string[] = [];
  const connector = isLast ? BOX.corner : BOX.tee;
  const childPrefix = prefix + (isLast ? BOX.blank : BOX.vertical) + '  ';

  const indicator = statusIndicator(scope.status);
  const scopeName = statusColor(scope.status)(scope.name);
  const scopeType = chalk.dim(`(${scope.scope_type})`);

  lines.push(`${prefix}${connector}${BOX.horizontal} ${indicator} ${scopeName} ${scopeType}`);

  // Render tasks
  const tasks = scope.tasks || [];
  tasks.forEach((task, idx) => {
    const isLastTask = idx === tasks.length - 1;
    lines.push(renderTask(task, childPrefix, isLastTask));
  });

  return lines;
}

// Render a phase with its scopes
function renderPhase(phase: Phase, prefix: string, isLast: boolean): string[] {
  const lines: string[] = [];
  const connector = isLast ? BOX.corner : BOX.tee;
  const childPrefix = prefix + (isLast ? BOX.blank : BOX.vertical) + '  ';

  const indicator = statusIndicator(phase.status);
  const phaseName = statusColor(phase.status)(phase.name);
  const phaseType = chalk.dim(`(${phase.phase_type})`);

  lines.push(`${prefix}${connector}${BOX.horizontal} ${indicator} ${phaseName} ${phaseType}`);

  // Render scopes
  const scopes = phase.scopes || [];
  scopes.forEach((scope, idx) => {
    const isLastScope = idx === scopes.length - 1;
    lines.push(...renderScope(scope, childPrefix, isLastScope));

    // Add blank line between scopes for readability
    if (!isLastScope) {
      lines.push(`${childPrefix}${BOX.vertical}`);
    }
  });

  return lines;
}

// Main render function
export function renderTree(data: DraftTree): string {
  const lines: string[] = [];
  const { draft, phases, scopes, tasks, stats, template } = data;

  // Header
  const draftIcon = '📋';
  const draftName = chalk.bold(draft.name);
  const draftType = chalk.cyan(`[${draft.draft_type}]`);
  const draftStatus = statusColor(draft.status)(draft.status);

  lines.push(`${draftIcon} ${draftName} ${draftType} ${draftStatus}`);
  lines.push(BOX.vertical);

  // Calculate total completion
  let allTasks: Task[] = [];

  // Render based on template
  if (template === 'matrix' || template === 'temporal') {
    // MATRIX/TEMPORAL: Draft → Phases → Scopes → Tasks (or Phases → Tasks)
    const phaseList = phases || [];
    phaseList.forEach((phase, idx) => {
      const isLastPhase = idx === phaseList.length - 1;
      lines.push(...renderPhase(phase, '', isLastPhase));

      // Collect tasks for stats
      phase.scopes?.forEach((scope) => {
        allTasks.push(...(scope.tasks || []));
      });

      // Add blank line between phases
      if (!isLastPhase) {
        lines.push(BOX.vertical);
      }
    });
  } else if (template === 'spatial') {
    // SPATIAL: Draft → Scopes → Tasks
    const scopeList = scopes || [];
    scopeList.forEach((scope, idx) => {
      const isLastScope = idx === scopeList.length - 1;
      lines.push(...renderScope(scope, '', isLastScope));
      allTasks.push(...(scope.tasks || []));

      if (!isLastScope) {
        lines.push(BOX.vertical);
      }
    });
  } else if (template === 'flat') {
    // FLAT: Draft → Tasks
    const taskList = tasks || [];
    allTasks = taskList;
    taskList.forEach((task, idx) => {
      const isLastTask = idx === taskList.length - 1;
      lines.push(renderTask(task, '', isLastTask));
    });
  } else if (template === 'atomic') {
    // ATOMIC: Just the draft info
    lines.push(chalk.dim('(No children - atomic draft)'));
  }

  // Stats footer
  lines.push('');
  const completion = calculateCompletion(allTasks);
  const progressStr = progressBar(completion.completed, completion.total);

  lines.push(chalk.dim('─'.repeat(50)));

  if (stats.phases > 0) {
    lines.push(
      chalk.dim(`📊 ${stats.phases} phases, ${stats.scopes} scopes, ${stats.tasks} tasks`)
    );
  } else if (stats.scopes > 0) {
    lines.push(chalk.dim(`📊 ${stats.scopes} scopes, ${stats.tasks} tasks`));
  } else if (stats.tasks > 0) {
    lines.push(chalk.dim(`📊 ${stats.tasks} tasks`));
  }

  lines.push(`${chalk.dim('Progress:')} ${progressStr}`);

  return lines.join('\n');
}
