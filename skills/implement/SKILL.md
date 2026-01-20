---
name: implement
description: Implement a draft by executing its tasks using subagents
allowed-tools:
  - mcp__arbora__call_tool
  - Task
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - Grep
---

# Implement Draft Skill

Executes a draft's tasks using subagents, marking each task complete as it's done.

## Usage

When the user runs `/arbora:implement` or asks to "implement this draft":

1. **Get the draft** with full tree structure:
   ```
   tool_name: "draft_get"
   params: {"id": "<draft_id>", "tree": true}
   ```
   If no ID provided, get the active draft or ask user to select one.

2. **Analyze the structure**:
   - For **matrix/temporal** templates: phases → scopes → tasks
   - For **spatial** templates: scopes → tasks
   - For **flat** templates: tasks directly on draft

3. **Execute tasks in order**:
   For each incomplete task:

   a. **Spawn a subagent** using the Task tool:
      ```
      Task(
        description: "<short task summary>",
        prompt: "Implement the following task:\n\nTitle: <task.title>\nDescription: <task.description>\n\nContext from draft:\n- Draft: <draft.name>\n- Phase: <phase.name> (if applicable)\n- Scope: <scope.name> (if applicable)\n\nComplete this task and report what was done.",
        subagent_type: "general-purpose"
      )
      ```

   b. **Mark task complete** after subagent finishes:
      ```
      tool_name: "task_update"
      params: {"id": "<task_id>", "completed": true}
      ```

   c. **Report progress** to user before moving to next task.

4. **Update phase/scope status** as sections complete:
   ```
   tool_name: "phase_update" or "scope_update"
   params: {"id": "<id>", "status": "done"}
   ```

## Arguments
$ARGUMENTS

- If argument is a draft ID or name, implement that specific draft
- If argument is "phase:<name>", only implement tasks in that phase
- If argument is "scope:<name>", only implement tasks in that scope

## Execution Modes

### Sequential (default)
Execute tasks one at a time, in order by phase → scope → task step.

### Parallel (if user specifies)
For independent tasks, spawn multiple subagents in parallel:
```
User: /arbora:implement --parallel
```
Use multiple Task tool calls in a single message for parallel execution.

## Important Notes

- **Ask before starting**: Confirm with user before executing multi-task drafts
- **Skip completed tasks**: Only process tasks where `completed: false`
- **Respect task order**: Use `step` field to determine execution order within scopes
- **Report failures**: If a subagent fails, report the error and ask user how to proceed
- **Don't call draft_get after updates**: Canvas auto-updates via optimistic updates

## Example Flow

```
User: /arbora:implement

Claude: I found the active draft "Add User Auth" with 3 phases and 8 tasks.

        Phase 1: Research (2 tasks)
        Phase 2: Implement (4 tasks)
        Phase 3: Test (2 tasks)

        Should I proceed with implementation?

User: yes

Claude: Starting Phase 1: Research

        [Spawns subagent for Task 1]
        ✓ Task 1 complete: Reviewed existing auth code

        [Spawns subagent for Task 2]
        ✓ Task 2 complete: Documented auth requirements

        Phase 1 complete. Moving to Phase 2: Implement
        ...
```
