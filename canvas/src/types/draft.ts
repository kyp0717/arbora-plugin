// Draft types matching Arbora MCP server responses

export type DraftStatus = 'queued' | 'active' | 'done' | 'blocked';
export type DraftType = 'feature' | 'issue' | 'spike' | 'document' | 'chore' | 'notice';
export type Template = 'matrix' | 'temporal' | 'spatial' | 'flat' | 'atomic';

export interface Task {
  id: string;
  parent_id: string;
  parent_type: 'scope' | 'phase' | 'draft';
  title: string;
  description: string | null;
  completed: boolean;
  step: number | null;
}

export interface Scope {
  id: string;
  parent_id: string;
  parent_type: 'phase' | 'draft';
  name: string;
  description: string | null;
  scope_type: string;
  status: DraftStatus;
  step: number | null;
  tasks: Task[];
}

export interface Diagram {
  name: string;
  type: 'architecture' | 'flow' | 'sequence' | 'erd' | 'state' | 'class' | 'component' | 'deployment';
  content: string;
}

export interface Phase {
  id: string;
  draft_id: string;
  name: string;
  description: string | null;
  status: DraftStatus;
  step: number;
  phase_type: string;
  findings: string | null;
  diagrams?: Diagram[];
  scopes: Scope[];
}

export interface Draft {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: DraftStatus;
  draft_type: DraftType;
}

export interface DraftTree {
  template: Template;
  stats: {
    phases: number;
    scopes: number;
    tasks: number;
  };
  draft: Draft;
  phases?: Phase[];
  scopes?: Scope[];
  tasks?: Task[];
}
