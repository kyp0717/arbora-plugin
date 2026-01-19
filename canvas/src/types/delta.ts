// Delta types for optimistic updates
import type { DraftStatus, DraftType } from './draft.js';

// Delta action types
export type DeltaAction =
  | 'task_update' | 'task_create' | 'task_delete'
  | 'scope_update' | 'scope_create' | 'scope_delete'
  | 'phase_update' | 'phase_create' | 'phase_delete'
  | 'draft_update'
  | 'diagram_add' | 'diagram_update' | 'diagram_delete';

// Base delta structure
interface BaseDelta {
  id: string;  // Unique delta ID for tracking/rollback
  timestamp: number;
  action: DeltaAction;
}

// Task deltas
export interface TaskUpdateDelta extends BaseDelta {
  action: 'task_update';
  taskId: string;
  patch: Partial<{
    title: string;
    description: string | null;
    completed: boolean;
    step: number | null;
  }>;
}

export interface TaskCreateDelta extends BaseDelta {
  action: 'task_create';
  task: {
    id: string;
    parent_id: string;
    parent_type: 'scope' | 'phase' | 'draft';
    title: string;
    description: string | null;
    completed: boolean;
    step: number | null;
  };
}

export interface TaskDeleteDelta extends BaseDelta {
  action: 'task_delete';
  taskId: string;
}

// Scope deltas
export interface ScopeUpdateDelta extends BaseDelta {
  action: 'scope_update';
  scopeId: string;
  patch: Partial<{
    name: string;
    description: string | null;
    scope_type: string;
    status: DraftStatus;
    step: number | null;
  }>;
}

export interface ScopeCreateDelta extends BaseDelta {
  action: 'scope_create';
  scope: {
    id: string;
    parent_id: string;
    parent_type: 'phase' | 'draft';
    name: string;
    description: string | null;
    scope_type: string;
    status: DraftStatus;
    step: number | null;
  };
}

export interface ScopeDeleteDelta extends BaseDelta {
  action: 'scope_delete';
  scopeId: string;
}

// Phase deltas
export interface PhaseUpdateDelta extends BaseDelta {
  action: 'phase_update';
  phaseId: string;
  patch: Partial<{
    name: string;
    description: string | null;
    status: DraftStatus;
    step: number;
    phase_type: string;
    findings: string | null;
  }>;
}

export interface PhaseCreateDelta extends BaseDelta {
  action: 'phase_create';
  phase: {
    id: string;
    draft_id: string;
    name: string;
    description: string | null;
    status: DraftStatus;
    step: number;
    phase_type: string;
    findings: string | null;
  };
}

export interface PhaseDeleteDelta extends BaseDelta {
  action: 'phase_delete';
  phaseId: string;
}

// Draft deltas
export interface DraftUpdateDelta extends BaseDelta {
  action: 'draft_update';
  patch: Partial<{
    name: string;
    description: string | null;
    status: DraftStatus;
    draft_type: DraftType;
  }>;
}

// Diagram deltas
export interface DiagramAddDelta extends BaseDelta {
  action: 'diagram_add';
  phaseId: string;
  diagram: {
    name: string;
    type: 'architecture' | 'flow' | 'sequence' | 'erd' | 'state' | 'class' | 'component' | 'deployment';
    content: string;
  };
}

export interface DiagramUpdateDelta extends BaseDelta {
  action: 'diagram_update';
  phaseId: string;
  diagramName: string;
  patch: Partial<{
    name: string;
    type: 'architecture' | 'flow' | 'sequence' | 'erd' | 'state' | 'class' | 'component' | 'deployment';
    content: string;
  }>;
}

export interface DiagramDeleteDelta extends BaseDelta {
  action: 'diagram_delete';
  phaseId: string;
  diagramName: string;
}

// Union type for all deltas
export type Delta =
  | TaskUpdateDelta | TaskCreateDelta | TaskDeleteDelta
  | ScopeUpdateDelta | ScopeCreateDelta | ScopeDeleteDelta
  | PhaseUpdateDelta | PhaseCreateDelta | PhaseDeleteDelta
  | DraftUpdateDelta
  | DiagramAddDelta | DiagramUpdateDelta | DiagramDeleteDelta;

// Delta file format (appended line by line)
export interface DeltaEntry {
  delta: Delta;
  applied: boolean;
  synced: boolean;
}
