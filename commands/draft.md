---
description: Create or view a draft for the current work
---

# Draft Command

When the user runs `/arbora:draft`, help them create or view drafts using the Arbora MCP server.

## If no arguments provided ($ARGUMENTS is empty):
1. Use `mcp__arbora__discover` to see available tools
2. List recent drafts in the current project using `mcp__arbora__call_tool` with `draft_get`
3. Show a summary of active work

## If arguments describe work to draft:
1. First check for similar existing drafts using `vector_search` tool
2. If similar found, ask user: "Add to existing draft or create new?"
3. Based on work type, use the appropriate template:
   - Feature/enhancement → `draft_matrix_create`
   - Bug fix → `draft_matrix_create` with draft_type="issue"
   - Research/spike → `draft_temporal_create`
   - Documentation → `draft_spatial_create`
   - Simple checklist → `draft_flat_create`
   - Announcement → `draft_atomic_create`

## Arguments
$ARGUMENTS

Use the Arbora MCP tools to execute the workflow.
