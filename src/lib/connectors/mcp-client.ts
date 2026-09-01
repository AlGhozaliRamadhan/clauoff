/**
 * Model Context Protocol (MCP) Client Adapter (ADR-0014).
 * Implements JSON-RPC 2.0 transport over Stdio and HTTP/SSE to discover and execute MCP tools.
 */

import { spawn } from 'child_process';
import type { Connector, ConnectorTool, ConnectorTestResult } from './types';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

const SAFE_URL_REGEX = /^https?:\/\/[a-zA-Z0-9.\-_]+(?::\d+)?(?:\/[a-zA-Z0-9_\-./~%+]*)?(?:\?[a-zA-Z0-9_.\-~=%&]*)?$/;

export function validateHttpUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('MCP endpoint URL is missing or invalid.');
  }

  const clean = rawUrl.trim();
  const match = clean.match(SAFE_URL_REGEX);
  if (!match) {
    throw new Error('Invalid or disallowed characters in MCP endpoint URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(match[0]);
  } catch {
    throw new Error('Invalid MCP endpoint URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted');
  }

  return match[0];
}

function getSafeTimeout(timeoutMs?: unknown, defaultMs: number = 30000): number {
  if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)) {
    if (timeoutMs >= 1000 && timeoutMs <= 120000) {
      return Math.floor(timeoutMs);
    }
  }
  return defaultMs;
}

const ALLOWED_MCP_COMMANDS: Record<string, string> = {
  npx: process.platform === 'win32' ? 'npx.cmd' : 'npx',
  'npx.cmd': 'npx.cmd',
  npm: process.platform === 'win32' ? 'npm.cmd' : 'npm',
  'npm.cmd': 'npm.cmd',
  node: process.platform === 'win32' ? 'node.exe' : 'node',
  'node.exe': 'node.exe',
  python: process.platform === 'win32' ? 'python.exe' : 'python',
  'python.exe': 'python.exe',
  python3: process.platform === 'win32' ? 'python3.exe' : 'python3',
  'python3.exe': 'python3.exe',
  uvx: process.platform === 'win32' ? 'uvx.cmd' : 'uvx',
  'uvx.cmd': 'uvx.cmd',
  uv: process.platform === 'win32' ? 'uv.exe' : 'uv',
  'uv.exe': 'uv.exe',
  docker: process.platform === 'win32' ? 'docker.exe' : 'docker',
  'docker.exe': 'docker.exe',
  deno: process.platform === 'win32' ? 'deno.exe' : 'deno',
  'deno.exe': 'deno.exe',
  bun: process.platform === 'win32' ? 'bun.exe' : 'bun',
  'bun.exe': 'bun.exe',
  git: process.platform === 'win32' ? 'git.exe' : 'git',
  'git.exe': 'git.exe',
};

function getSafeExecutable(command: string): string {
  const clean = String(command).trim().toLowerCase();
  const allowed = ALLOWED_MCP_COMMANDS[clean];
  if (allowed) {
    return allowed;
  }
  throw new Error(`Executable "${command}" is not in the allowed MCP commands list.`);
}

/**
 * Executes a single MCP JSON-RPC exchange over stdio with timeout guard.
 */
export async function executeMcpStdioSession<T>(
  connector: Connector,
  actions: (sendRequest: (method: string, params?: any) => Promise<any>) => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const { command, args = [], env = {} } = connector.config;

  if (!command) {
    throw new Error(`MCP Stdio connector "${connector.name}" has no command specified.`);
  }

  const execCommand = getSafeExecutable(command);
  const safeArgs = Array.isArray(args) ? args.map((a) => String(a)) : [];
  const safeTimeoutMs = getSafeTimeout(timeoutMs, 30000);

  return new Promise<T>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let nextId = 1;
    const pendingRequests = new Map<number | string, { resolve: (val: any) => void; reject: (err: any) => void }>();

    // Merge system environment with configured connector environment
    const procEnv = {
      ...process.env,
      ...env,
    };

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(execCommand, safeArgs, {
        env: procEnv,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return reject(new Error(`Failed to spawn MCP process "${command}": ${err instanceof Error ? err.message : String(err)}`));
    }

    if (!proc.stdout || !proc.stdin || !proc.stderr) {
      return reject(new Error(`Failed to initialize stdio streams for process "${command}".`));
    }

    const stdoutStream = proc.stdout;
    const stdinStream = proc.stdin;
    const stderrStream = proc.stderr;

    let buffer = '';
    let stderrBuffer = '';

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        if (!proc.killed) {
          proc.kill('SIGTERM');
        }
      } catch {
        // ignore kill error
      }
    };

    const timerDuration = safeTimeoutMs >= 1000 && safeTimeoutMs <= 120000 ? safeTimeoutMs : 30000;
    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`MCP process timed out after ${timerDuration}ms. Stderr: ${stderrBuffer.slice(-300)}`));
    }, timerDuration);

    stdoutStream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const message: JsonRpcResponse = JSON.parse(trimmed);
          if (message.id !== undefined && pendingRequests.has(message.id)) {
            const { resolve: reqResolve, reject: reqReject } = pendingRequests.get(message.id)!;
            pendingRequests.delete(message.id);

            if (message.error) {
              reqReject(new Error(`MCP error ${message.error.code}: ${message.error.message}`));
            } else {
              reqResolve(message.result);
            }
          }
        } catch {
          // Ignore non-JSON output (e.g. logging)
        }
      }
    });

    stderrStream.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf-8');
    });

    proc.on('error', (err) => {
      cleanup();
      reject(new Error(`MCP process error: ${err.message}`));
    });

    proc.on('exit', (code) => {
      if (pendingRequests.size > 0) {
        cleanup();
        reject(new Error(`MCP process exited with code ${code}. Stderr: ${stderrBuffer.slice(-300)}`));
      }
    });

    const sendRequest = async (method: string, params?: any): Promise<any> => {
      const id = nextId++;
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      return new Promise((res, rej) => {
        pendingRequests.set(id, { resolve: res, reject: rej });
        try {
          stdinStream.write(JSON.stringify(req) + '\n');
        } catch (err) {
          pendingRequests.delete(id);
          rej(err);
        }
      });
    };

    // Run MCP Lifecycle sequence
    (async () => {
      try {
        // 1. Initialize Handshake
        await sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: 'cogito-mcp-client',
            version: '1.0.0',
          },
        });

        // 2. Initialized Notification
        stdinStream.write(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
          }) + '\n'
        );

        // 3. User action
        const result = await actions(sendRequest);
        cleanup();
        resolve(result);
      } catch (err) {
        cleanup();
        reject(err);
      }
    })();
  });
}

/**
 * Discovers available tools from an MCP Stdio or HTTP server.
 */
export async function discoverMcpTools(connector: Connector): Promise<ConnectorTool[]> {
  if (connector.type === 'mcp_stdio') {
    return executeMcpStdioSession(connector, async (sendRequest) => {
      const res = await sendRequest('tools/list', {});
      const tools = res?.tools ?? [];

      return tools.map((t: any): ConnectorTool => {
        const properties = t.inputSchema?.properties || {};
        const paramNames = Object.keys(properties);
        const usageExample = paramNames.length > 0
          ? `<action name="${t.name}">{\n${paramNames.map(p => `  "${p}": "..."`).join(',\n')}\n}</action>`
          : `<action name="${t.name}"></action>`;

        return {
          name: t.name,
          description: t.description || `Tool ${t.name} provided by ${connector.name}`,
          usage: usageExample,
          inputSchema: t.inputSchema,
          parameters: properties,
        };
      });
    }, connector.config.timeoutMs || 15000);
  }

  if (connector.type === 'mcp_sse' || connector.type === 'custom_http') {
    const rawUrl = connector.config.url;
    if (!rawUrl) throw new Error('No URL configured for remote MCP endpoint.');
    const url = validateHttpUrl(rawUrl);
    const timeout = getSafeTimeout(connector.config.timeoutMs, 15000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(connector.config.headers || {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
      throw new Error(`Remote MCP endpoint returned status ${res.status}`);
    }

    const data = await res.json();
    const tools = data?.result?.tools ?? [];
    return tools.map((t: any): ConnectorTool => ({
      name: t.name,
      description: t.description || `Tool ${t.name}`,
      inputSchema: t.inputSchema,
      usage: `<action name="${t.name}">...</action>`,
    }));
  }

  return connector.tools || [];
}

/**
 * Calls an MCP tool with specific arguments.
 */
export async function callMcpTool(
  connector: Connector,
  toolName: string,
  args: any
): Promise<{ text: string; isError?: boolean }> {
  if (connector.type === 'mcp_stdio') {
    return executeMcpStdioSession(connector, async (sendRequest) => {
      const res = await sendRequest('tools/call', {
        name: toolName,
        arguments: typeof args === 'string' ? parseInputArguments(args) : args,
      });

      const contents = res?.content ?? [];
      const textParts = contents
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text);

      const combinedText = textParts.join('\n\n') || JSON.stringify(res, null, 2);
      return {
        text: combinedText,
        isError: res?.isError,
      };
    }, connector.config.timeoutMs || 30000);
  }

  if (connector.type === 'mcp_sse' || connector.type === 'custom_http') {
    const rawUrl = connector.config.url;
    if (!rawUrl) throw new Error('No URL configured for remote MCP endpoint.');
    const url = validateHttpUrl(rawUrl);
    const timeout = getSafeTimeout(connector.config.timeoutMs, 30000);

    const parsedArgs = typeof args === 'string' ? parseInputArguments(args) : args;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(connector.config.headers || {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parsedArgs,
        },
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
      throw new Error(`Remote MCP call failed with status ${res.status}`);
    }

    const data = await res.json();
    const contents = data?.result?.content ?? [];
    const textParts = contents.map((c: any) => c.text || JSON.stringify(c));
    return {
      text: textParts.join('\n\n') || JSON.stringify(data.result, null, 2),
      isError: data?.result?.isError,
    };
  }

  throw new Error(`Unsupported connector type: ${connector.type}`);
}

/**
 * Tests connection to an MCP server or built-in connector.
 */
export async function testConnectorConnection(connector: Connector): Promise<ConnectorTestResult> {
  const startTime = Date.now();
  try {
    if (connector.type === 'builtin') {
      return {
        success: true,
        message: 'Built-in connector is operational and ready.',
        latencyMs: 0,
        discoveredTools: connector.tools,
      };
    }

    const tools = await discoverMcpTools(connector);
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      message: `Connection successful. Discovered ${tools.length} tool(s).`,
      latencyMs,
      discoveredTools: tools,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
      latencyMs,
    };
  }
}

/**
 * Safely parses input string as JSON object or key-value format.
 */
function parseInputArguments(input: string): any {
  const trimmed = input.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fallback
    }
  }

  return { input: trimmed };
}
