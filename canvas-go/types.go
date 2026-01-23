package main

import "encoding/json"

// Draft types matching Arbora MCP server responses

type Task struct {
	ID          string  `json:"id"`
	ParentID    string  `json:"parent_id"`
	ParentType  string  `json:"parent_type"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Completed   bool    `json:"completed"`
	Step        *int    `json:"step"`
}

type Scope struct {
	ID          string  `json:"id"`
	ParentID    string  `json:"parent_id"`
	ParentType  string  `json:"parent_type"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	ScopeType   string  `json:"scope_type"`
	Status      string  `json:"status"`
	Step        *int    `json:"step"`
	Tasks       []Task  `json:"tasks"`
}

type Diagram struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Content string `json:"content"`
}

type Phase struct {
	ID          string    `json:"id"`
	DraftID     string    `json:"draft_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Status      string    `json:"status"`
	Step        int       `json:"step"`
	PhaseType   string    `json:"phase_type"`
	Findings    *string   `json:"findings"`
	Diagrams    []Diagram `json:"diagrams,omitempty"`
	Scopes      []Scope   `json:"scopes"`
}

type Draft struct {
	ID          string  `json:"id"`
	ProjectID   string  `json:"project_id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
	DraftType   string  `json:"draft_type"`
}

type DraftStats struct {
	Phases int `json:"phases"`
	Scopes int `json:"scopes"`
	Tasks  int `json:"tasks"`
}

type DraftTree struct {
	Template string     `json:"template"`
	Stats    DraftStats `json:"stats"`
	Draft    Draft      `json:"draft"`
	Phases   []Phase    `json:"phases,omitempty"`
	Scopes   []Scope    `json:"scopes,omitempty"`
	Tasks    []Task     `json:"tasks,omitempty"`
}

// IPC message types

type IpcMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type IpcCommand struct {
	Action string `json:"action"`
}

type Delta struct {
	ID        string          `json:"id"`
	Timestamp int64           `json:"timestamp"`
	Action    string          `json:"action"`
	TaskID    string          `json:"taskId,omitempty"`
	ScopeID   string          `json:"scopeId,omitempty"`
	PhaseID   string          `json:"phaseId,omitempty"`
	Patch     json.RawMessage `json:"patch,omitempty"`
	Task      *Task           `json:"task,omitempty"`
	Scope     *Scope          `json:"scope,omitempty"`
	Phase     *Phase          `json:"phase,omitempty"`
	Diagram   *Diagram        `json:"diagram,omitempty"`
}
