package main

import (
	"bufio"
	"encoding/json"
	"log"
	"net"
	"os"
	"sync"
)

const socketPath = "/tmp/arbora-canvas.sock"

// AppState holds the application state
type AppState struct {
	mu            sync.RWMutex
	draft         *DraftTree
	pendingDeltas []Delta
	listeners     []func(*DraftTree)
}

func NewAppState() *AppState {
	return &AppState{
		pendingDeltas: make([]Delta, 0),
		listeners:     make([]func(*DraftTree), 0),
	}
}

func (s *AppState) SetDraft(draft *DraftTree) {
	s.mu.Lock()
	s.draft = draft
	s.pendingDeltas = nil
	s.mu.Unlock()
	s.notifyListeners()
}

func (s *AppState) GetDraft() *DraftTree {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.draft
}

func (s *AppState) ApplyDelta(delta Delta) {
	s.mu.Lock()
	if s.draft != nil {
		applyDeltaToDraft(s.draft, delta)
		s.pendingDeltas = append(s.pendingDeltas, delta)
	}
	s.mu.Unlock()
	s.notifyListeners()
}

func (s *AppState) AddListener(fn func(*DraftTree)) {
	s.mu.Lock()
	s.listeners = append(s.listeners, fn)
	s.mu.Unlock()
}

func (s *AppState) notifyListeners() {
	s.mu.RLock()
	draft := s.draft
	listeners := s.listeners
	s.mu.RUnlock()

	for _, fn := range listeners {
		fn(draft)
	}
}

func (s *AppState) PendingCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.pendingDeltas)
}

// Apply delta to draft
func applyDeltaToDraft(draft *DraftTree, delta Delta) {
	switch delta.Action {
	case "task_update":
		if task := findTask(draft, delta.TaskID); task != nil {
			var patch map[string]interface{}
			json.Unmarshal(delta.Patch, &patch)
			if v, ok := patch["completed"].(bool); ok {
				task.Completed = v
			}
			if v, ok := patch["title"].(string); ok {
				task.Title = v
			}
		}
	case "task_create":
		if delta.Task != nil {
			addTask(draft, *delta.Task)
		}
	case "task_delete":
		deleteTask(draft, delta.TaskID)
	case "scope_update":
		if scope := findScope(draft, delta.ScopeID); scope != nil {
			var patch map[string]interface{}
			json.Unmarshal(delta.Patch, &patch)
			if v, ok := patch["status"].(string); ok {
				scope.Status = v
			}
			if v, ok := patch["name"].(string); ok {
				scope.Name = v
			}
		}
	case "phase_update":
		if phase := findPhase(draft, delta.PhaseID); phase != nil {
			var patch map[string]interface{}
			json.Unmarshal(delta.Patch, &patch)
			if v, ok := patch["status"].(string); ok {
				phase.Status = v
			}
			if v, ok := patch["name"].(string); ok {
				phase.Name = v
			}
		}
	case "draft_update":
		var patch map[string]interface{}
		json.Unmarshal(delta.Patch, &patch)
		if v, ok := patch["status"].(string); ok {
			draft.Draft.Status = v
		}
		if v, ok := patch["name"].(string); ok {
			draft.Draft.Name = v
		}
	}
}

func findTask(draft *DraftTree, taskID string) *Task {
	for i := range draft.Tasks {
		if draft.Tasks[i].ID == taskID {
			return &draft.Tasks[i]
		}
	}
	for i := range draft.Scopes {
		for j := range draft.Scopes[i].Tasks {
			if draft.Scopes[i].Tasks[j].ID == taskID {
				return &draft.Scopes[i].Tasks[j]
			}
		}
	}
	for i := range draft.Phases {
		for j := range draft.Phases[i].Scopes {
			for k := range draft.Phases[i].Scopes[j].Tasks {
				if draft.Phases[i].Scopes[j].Tasks[k].ID == taskID {
					return &draft.Phases[i].Scopes[j].Tasks[k]
				}
			}
		}
	}
	return nil
}

func findScope(draft *DraftTree, scopeID string) *Scope {
	for i := range draft.Scopes {
		if draft.Scopes[i].ID == scopeID {
			return &draft.Scopes[i]
		}
	}
	for i := range draft.Phases {
		for j := range draft.Phases[i].Scopes {
			if draft.Phases[i].Scopes[j].ID == scopeID {
				return &draft.Phases[i].Scopes[j]
			}
		}
	}
	return nil
}

func findPhase(draft *DraftTree, phaseID string) *Phase {
	for i := range draft.Phases {
		if draft.Phases[i].ID == phaseID {
			return &draft.Phases[i]
		}
	}
	return nil
}

func addTask(draft *DraftTree, task Task) {
	if task.ParentType == "draft" {
		draft.Tasks = append(draft.Tasks, task)
		draft.Stats.Tasks++
	} else if task.ParentType == "scope" {
		if scope := findScope(draft, task.ParentID); scope != nil {
			scope.Tasks = append(scope.Tasks, task)
			draft.Stats.Tasks++
		}
	}
}

func deleteTask(draft *DraftTree, taskID string) {
	for i := range draft.Tasks {
		if draft.Tasks[i].ID == taskID {
			draft.Tasks = append(draft.Tasks[:i], draft.Tasks[i+1:]...)
			draft.Stats.Tasks--
			return
		}
	}
	for i := range draft.Scopes {
		for j := range draft.Scopes[i].Tasks {
			if draft.Scopes[i].Tasks[j].ID == taskID {
				draft.Scopes[i].Tasks = append(draft.Scopes[i].Tasks[:j], draft.Scopes[i].Tasks[j+1:]...)
				draft.Stats.Tasks--
				return
			}
		}
	}
	for i := range draft.Phases {
		for j := range draft.Phases[i].Scopes {
			for k := range draft.Phases[i].Scopes[j].Tasks {
				if draft.Phases[i].Scopes[j].Tasks[k].ID == taskID {
					draft.Phases[i].Scopes[j].Tasks = append(
						draft.Phases[i].Scopes[j].Tasks[:k],
						draft.Phases[i].Scopes[j].Tasks[k+1:]...,
					)
					draft.Stats.Tasks--
					return
				}
			}
		}
	}
}

// StartSocketServer starts the Unix socket server
func StartSocketServer(state *AppState, showWindow func(), hideWindow func()) {
	// Remove existing socket
	os.Remove(socketPath)

	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Printf("Failed to create socket: %v", err)
		return
	}
	defer listener.Close()
	defer os.Remove(socketPath)

	log.Printf("Socket server listening on %s", socketPath)

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("Accept error: %v", err)
			continue
		}
		go handleConnection(conn, state, showWindow, hideWindow)
	}
}

func handleConnection(conn net.Conn, state *AppState, showWindow func(), hideWindow func()) {
	defer conn.Close()

	scanner := bufio.NewScanner(conn)
	// Increase buffer size for large messages
	buf := make([]byte, 1024*1024) // 1MB
	scanner.Buffer(buf, len(buf))

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var msg IpcMessage
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			conn.Write([]byte(`{"error":"invalid json"}` + "\n"))
			continue
		}

		response := processMessage(msg, state, showWindow, hideWindow)
		conn.Write([]byte(response + "\n"))
	}
}

func processMessage(msg IpcMessage, state *AppState, showWindow func(), hideWindow func()) string {
	switch msg.Type {
	case "full_state":
		var draft DraftTree
		if err := json.Unmarshal(msg.Payload, &draft); err != nil {
			log.Printf("Failed to parse draft: %v", err)
			return `{"error":"invalid draft"}`
		}
		log.Printf("Received full state: %s", draft.Draft.Name)
		state.SetDraft(&draft)
		return `{"status":"ok"}`

	case "delta":
		var delta Delta
		if err := json.Unmarshal(msg.Payload, &delta); err != nil {
			log.Printf("Failed to parse delta: %v", err)
			return `{"error":"invalid delta"}`
		}
		log.Printf("Received delta: %s", delta.Action)
		state.ApplyDelta(delta)
		return `{"status":"ok"}`

	case "command":
		var cmd IpcCommand
		if err := json.Unmarshal(msg.Payload, &cmd); err != nil {
			log.Printf("Failed to parse command: %v", err)
			return `{"error":"invalid command"}`
		}
		return handleCommand(cmd, showWindow, hideWindow)

	default:
		return `{"error":"unknown message type"}`
	}
}

func handleCommand(cmd IpcCommand, showWindow func(), hideWindow func()) string {
	switch cmd.Action {
	case "ping":
		return `{"status":"pong"}`
	case "show":
		if showWindow != nil {
			showWindow()
		}
		return `{"status":"ok"}`
	case "hide":
		if hideWindow != nil {
			hideWindow()
		}
		return `{"status":"ok"}`
	default:
		return `{"error":"unknown command"}`
	}
}

// CleanupSocket removes the socket file
func CleanupSocket() {
	os.Remove(socketPath)
}
