// Draft store with optimistic updates
import type { DraftTree, Task, Scope, Phase, Delta } from '../types/index.js';

export interface DraftStore {
  draft: DraftTree | null;
  pendingDeltas: Delta[];
  lastSyncTime: number;

  // Core operations
  setDraft(draft: DraftTree): void;
  getDraft(): DraftTree | null;

  // Apply delta optimistically
  applyDelta(delta: Delta): void;

  // Sync operations
  applyServerUpdate(draft: DraftTree): void;
  clearPendingDeltas(): void;
}

// Deep clone helper
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Find and update a task in the draft tree
function findAndUpdateTask(
  draft: DraftTree,
  taskId: string,
  updater: (task: Task) => Task | null
): boolean {
  // Check top-level tasks (flat template)
  if (draft.tasks) {
    const idx = draft.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      const result = updater(draft.tasks[idx]);
      if (result === null) {
        draft.tasks.splice(idx, 1);
        draft.stats.tasks--;
      } else {
        draft.tasks[idx] = result;
      }
      return true;
    }
  }

  // Check tasks in scopes (spatial template)
  if (draft.scopes) {
    for (const scope of draft.scopes) {
      const idx = scope.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        const result = updater(scope.tasks[idx]);
        if (result === null) {
          scope.tasks.splice(idx, 1);
          draft.stats.tasks--;
        } else {
          scope.tasks[idx] = result;
        }
        return true;
      }
    }
  }

  // Check tasks in phases -> scopes (matrix/temporal template)
  if (draft.phases) {
    for (const phase of draft.phases) {
      for (const scope of phase.scopes) {
        const idx = scope.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
          const result = updater(scope.tasks[idx]);
          if (result === null) {
            scope.tasks.splice(idx, 1);
            draft.stats.tasks--;
          } else {
            scope.tasks[idx] = result;
          }
          return true;
        }
      }
    }
  }

  return false;
}

// Find and update a scope in the draft tree
function findAndUpdateScope(
  draft: DraftTree,
  scopeId: string,
  updater: (scope: Scope) => Scope | null
): boolean {
  // Check top-level scopes (spatial template)
  if (draft.scopes) {
    const idx = draft.scopes.findIndex(s => s.id === scopeId);
    if (idx !== -1) {
      const result = updater(draft.scopes[idx]);
      if (result === null) {
        draft.scopes.splice(idx, 1);
        draft.stats.scopes--;
      } else {
        draft.scopes[idx] = result;
      }
      return true;
    }
  }

  // Check scopes in phases (matrix/temporal template)
  if (draft.phases) {
    for (const phase of draft.phases) {
      const idx = phase.scopes.findIndex(s => s.id === scopeId);
      if (idx !== -1) {
        const result = updater(phase.scopes[idx]);
        if (result === null) {
          phase.scopes.splice(idx, 1);
          draft.stats.scopes--;
        } else {
          phase.scopes[idx] = result;
        }
        return true;
      }
    }
  }

  return false;
}

// Find and update a phase in the draft tree
function findAndUpdatePhase(
  draft: DraftTree,
  phaseId: string,
  updater: (phase: Phase) => Phase | null
): boolean {
  if (!draft.phases) return false;

  const idx = draft.phases.findIndex(p => p.id === phaseId);
  if (idx !== -1) {
    const result = updater(draft.phases[idx]);
    if (result === null) {
      draft.phases.splice(idx, 1);
      draft.stats.phases--;
    } else {
      draft.phases[idx] = result;
    }
    return true;
  }

  return false;
}

// Apply a delta to a draft tree (mutates the draft)
function applyDeltaToDraft(draft: DraftTree, delta: Delta): boolean {
  switch (delta.action) {
    case 'task_update':
      return findAndUpdateTask(draft, delta.taskId, (task) => ({
        ...task,
        ...delta.patch
      }));

    case 'task_create': {
      const newTask = delta.task;
      // Find parent and add task
      if (newTask.parent_type === 'draft') {
        if (!draft.tasks) draft.tasks = [];
        draft.tasks.push(newTask);
        draft.stats.tasks++;
        return true;
      } else if (newTask.parent_type === 'scope') {
        return findAndUpdateScope(draft, newTask.parent_id, (scope) => {
          scope.tasks.push(newTask);
          draft.stats.tasks++;
          return scope;
        });
      }
      return false;
    }

    case 'task_delete':
      return findAndUpdateTask(draft, delta.taskId, () => null);

    case 'scope_update':
      return findAndUpdateScope(draft, delta.scopeId, (scope) => ({
        ...scope,
        ...delta.patch,
        tasks: scope.tasks  // Preserve tasks
      }));

    case 'scope_create': {
      const newScope: Scope = { ...delta.scope, tasks: [] };
      if (newScope.parent_type === 'draft') {
        if (!draft.scopes) draft.scopes = [];
        draft.scopes.push(newScope);
        draft.stats.scopes++;
        return true;
      } else if (newScope.parent_type === 'phase') {
        return findAndUpdatePhase(draft, newScope.parent_id, (phase) => {
          phase.scopes.push(newScope);
          draft.stats.scopes++;
          return phase;
        });
      }
      return false;
    }

    case 'scope_delete':
      return findAndUpdateScope(draft, delta.scopeId, () => null);

    case 'phase_update':
      return findAndUpdatePhase(draft, delta.phaseId, (phase) => ({
        ...phase,
        ...delta.patch,
        scopes: phase.scopes,  // Preserve scopes
        diagrams: phase.diagrams  // Preserve diagrams
      }));

    case 'phase_create': {
      if (!draft.phases) draft.phases = [];
      const newPhase: Phase = { ...delta.phase, scopes: [], diagrams: [] };
      draft.phases.push(newPhase);
      draft.stats.phases++;
      return true;
    }

    case 'phase_delete':
      return findAndUpdatePhase(draft, delta.phaseId, () => null);

    case 'draft_update':
      draft.draft = { ...draft.draft, ...delta.patch };
      return true;

    case 'diagram_add':
      return findAndUpdatePhase(draft, delta.phaseId, (phase) => {
        if (!phase.diagrams) phase.diagrams = [];
        phase.diagrams.push(delta.diagram);
        return phase;
      });

    case 'diagram_update':
      return findAndUpdatePhase(draft, delta.phaseId, (phase) => {
        if (!phase.diagrams) return phase;
        const idx = phase.diagrams.findIndex(d => d.name === delta.diagramName);
        if (idx !== -1) {
          phase.diagrams[idx] = { ...phase.diagrams[idx], ...delta.patch };
        }
        return phase;
      });

    case 'diagram_delete':
      return findAndUpdatePhase(draft, delta.phaseId, (phase) => {
        if (!phase.diagrams) return phase;
        phase.diagrams = phase.diagrams.filter(d => d.name !== delta.diagramName);
        return phase;
      });

    default:
      return false;
  }
}

// Create a draft store instance
export function createDraftStore(): DraftStore {
  let draft: DraftTree | null = null;
  let pendingDeltas: Delta[] = [];
  let lastSyncTime = 0;

  return {
    get draft() { return draft; },
    get pendingDeltas() { return pendingDeltas; },
    get lastSyncTime() { return lastSyncTime; },

    setDraft(newDraft: DraftTree) {
      draft = deepClone(newDraft);
      lastSyncTime = Date.now();
    },

    getDraft() {
      return draft;
    },

    applyDelta(delta: Delta) {
      if (!draft) return;

      // Clone draft before mutation
      draft = deepClone(draft);

      // Apply delta
      const success = applyDeltaToDraft(draft, delta);

      if (success) {
        // Track pending delta for potential rollback
        pendingDeltas.push(delta);
      }
    },

    applyServerUpdate(serverDraft: DraftTree) {
      // Server is source of truth - replace local state
      draft = deepClone(serverDraft);
      pendingDeltas = [];
      lastSyncTime = Date.now();
    },

    clearPendingDeltas() {
      pendingDeltas = [];
    }
  };
}

// Singleton store instance
let storeInstance: DraftStore | null = null;

export function getStore(): DraftStore {
  if (!storeInstance) {
    storeInstance = createDraftStore();
  }
  return storeInstance;
}

// Parse delta from JSON line
export function parseDelta(line: string): Delta | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed && parsed.action && parsed.id && parsed.timestamp) {
      return parsed as Delta;
    }
    return null;
  } catch {
    return null;
  }
}
