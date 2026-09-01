/**
 * Connectors Tool Registry Bridge (ADR-0014).
 * Dynamically resolves tools from all enabled connectors and routes actions.
 */

import type { ToolDefinition, ToolExecution } from '@/lib/agent/tool-parser';
import { listConnectors } from './storage';
import { callMcpTool } from './mcp-client';
import fs from 'fs';
import path from 'path';

/**
 * Loads all active tools from enabled connectors.
 */
export async function getDynamicConnectorTools(): Promise<ToolDefinition[]> {
  const connectors = await listConnectors();
  const activeConnectors = connectors.filter((c) => c.enabled);
  const tools: ToolDefinition[] = [];

  for (const connector of activeConnectors) {
    for (const tool of connector.tools) {
      // Build executable tool definition
      tools.push({
        name: tool.name,
        description: `[Connector: ${connector.name}] ${tool.description}`,
        usage: tool.usage || `<action name="${tool.name}">input</action>`,
        execute: async (input: string): Promise<ToolExecution> => {
          return executeConnectorToolAction(connector, tool.name, input);
        },
      });
    }
  }

  return tools;
}

/**
 * Dispatches a tool execution to its owning connector.
 */
async function executeConnectorToolAction(
  connector: any,
  toolName: string,
  input: string
): Promise<ToolExecution> {
  // Built-in tool handling
  if (connector.id === 'builtin-filesystem') {
    if (toolName === 'list_directory') {
      return handleListDirectory(input);
    }
    if (toolName === 'read_project_file') {
      return handleReadFile(input);
    }
  }

  if (connector.id === 'builtin-github') {
    if (toolName === 'github_fetch_repo') {
      return handleGitHubFetchRepo(input);
    }
    if (toolName === 'github_read_file') {
      return handleGitHubReadFile(input);
    }
  }

  // MCP / Custom HTTP server tool handling
  if (connector.type === 'mcp_stdio' || connector.type === 'mcp_sse' || connector.type === 'custom_http') {
    try {
      const res = await callMcpTool(connector, toolName, input);
      return {
        modelContext: res.text,
        status: {
          label: `${connector.name}: ${toolName}`,
          items: [{ title: toolName, snippet: res.text.substring(0, 300) }],
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        modelContext: `Tool ${toolName} failed on connector ${connector.name}: ${msg}`,
      };
    }
  }

  return {
    modelContext: `Tool "${toolName}" executed on connector "${connector.name}".`,
  };
}

async function handleListDirectory(dirPath: string) {
  const target = path.resolve(/*turbopackIgnore: true*/ process.cwd(), dirPath.trim() || '.');
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ target)) {
      return { modelContext: `Directory not found: ${dirPath}` };
    }
    const entries = fs.readdirSync(/*turbopackIgnore: true*/ target, { withFileTypes: true });
    const list = entries.map((e) => `${e.isDirectory() ? '[DIR] ' : '[FILE]'} ${e.name}`).join('\n');
    return {
      modelContext: `Directory listing of ${dirPath || '.'}:\n${list}`,
      status: {
        label: `List directory: ${dirPath || '.'}`,
        items: entries.slice(0, 10).map((e) => ({ title: e.name, snippet: e.isDirectory() ? 'Directory' : 'File' })),
      },
    };
  } catch (err) {
    return { modelContext: `Error listing directory: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function handleReadFile(filePath: string) {
  const target = path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath.trim());
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ target)) {
      return { modelContext: `File not found: ${filePath}` };
    }
    const content = fs.readFileSync(/*turbopackIgnore: true*/ target, 'utf-8');
    return {
      modelContext: `Content of ${filePath}:\n\n${content.substring(0, 8000)}`,
      status: {
        label: `Read file: ${filePath}`,
        items: [{ title: filePath, snippet: content.substring(0, 200) }],
      },
    };
  } catch (err) {
    return { modelContext: `Error reading file: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function handleGitHubFetchRepo(repoInput: string) {
  const repo = repoInput.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/main?recursive=1`, {
      headers: { 'User-Agent': 'Cogito-Agent-Connector' },
    });
    if (!res.ok) {
      return { modelContext: `GitHub API error fetching repository tree for ${repo}: HTTP ${res.status}` };
    }
    const data = await res.json();
    const tree = (data.tree || []).slice(0, 100).map((item: any) => `${item.type === 'tree' ? '[DIR]' : '[FILE]'} ${item.path}`).join('\n');
    return {
      modelContext: `GitHub repository tree for ${repo}:\n${tree}`,
      status: {
        label: `GitHub repo: ${repo}`,
        items: [{ title: repo, snippet: `Found ${data.tree?.length || 0} items` }],
      },
    };
  } catch (err) {
    return { modelContext: `Error fetching GitHub repo: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function handleGitHubReadFile(input: string) {
  // Format: owner/repo/branch/path or full github url
  let rawUrl = input.trim();
  if (rawUrl.startsWith('https://github.com/')) {
    rawUrl = rawUrl.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/');
  } else {
    const parts = rawUrl.split('/');
    if (parts.length >= 3) {
      const owner = parts[0];
      const repo = parts[1];
      const rest = parts.slice(2).join('/');
      rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${rest}`;
    }
  }

  try {
    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': 'Cogito-Agent-Connector' },
    });
    if (!res.ok) {
      return { modelContext: `Could not fetch raw file from ${rawUrl}: HTTP ${res.status}` };
    }
    const content = await res.text();
    return {
      modelContext: `Content of GitHub file (${rawUrl}):\n\n${content.substring(0, 8000)}`,
      status: {
        label: `GitHub File: ${path.basename(rawUrl)}`,
        items: [{ title: path.basename(rawUrl), url: rawUrl, snippet: content.substring(0, 250) }],
      },
    };
  } catch (err) {
    return { modelContext: `Error reading GitHub file: ${err instanceof Error ? err.message : String(err)}` };
  }
}
