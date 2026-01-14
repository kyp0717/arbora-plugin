#!/usr/bin/env bun
/**
 * Refresh draft data by calling the arbora MCP server
 * Usage: bun run refresh.ts <draft_id>
 */

import { tmpdir } from 'os';
import { join } from 'path';

const DATA_FILE = join(tmpdir(), 'arbora-canvas-data.json');
const ARBORA_URL = process.env.ARBORA_URL || 'http://localhost:9000/mcp';

async function refreshDraft(draftId: string): Promise<boolean> {
  try {
    // MCP HTTP Streamable transport requires session-based communication
    // Step 1: Initialize and get session ID
    const initResponse = await fetch(ARBORA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'arbora-canvas-refresh',
            version: '1.0.0',
          },
        },
      }),
    });

    if (!initResponse.ok) {
      console.error('Init failed:', await initResponse.text());
      return false;
    }

    // Get session ID from response headers
    const sessionId = initResponse.headers.get('mcp-session-id');
    if (!sessionId) {
      console.error('No session ID in response');
      return false;
    }

    // Parse SSE response for initialize
    const initText = await initResponse.text();
    const initData = parseSSEResponse(initText);
    if (!initData?.result) {
      console.error('Init failed - no result');
      return false;
    }

    // Step 2: Send initialized notification
    await fetch(ARBORA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });

    // Step 3: Call the tool with session ID
    const toolResponse = await fetch(ARBORA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'call_tool',
          arguments: {
            tool_name: 'draft_get',
            params: JSON.stringify({ id: draftId, tree: true }),
          },
        },
      }),
    });

    if (!toolResponse.ok) {
      console.error('Tool call failed:', await toolResponse.text());
      return false;
    }

    const toolText = await toolResponse.text();
    const toolData = parseSSEResponse(toolText);

    if (toolData?.result?.content?.[0]?.text) {
      const draftTree = toolData.result.content[0].text;
      await Bun.write(DATA_FILE, draftTree);
      console.log('Draft refreshed successfully');
      return true;
    } else {
      console.error('No draft data in response');
      return false;
    }
  } catch (error) {
    console.error('Error refreshing draft:', error);
    return false;
  }
}

// Parse SSE response - extract JSON from event stream
function parseSSEResponse(text: string): any {
  // SSE format: "event: message\ndata: {...}\n\n"
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        continue;
      }
    }
  }
  // Try parsing as plain JSON (non-SSE response)
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Main
const draftId = process.argv[2];
if (!draftId) {
  console.error('Usage: bun run refresh.ts <draft_id>');
  process.exit(1);
}

const success = await refreshDraft(draftId);
process.exit(success ? 0 : 1);
