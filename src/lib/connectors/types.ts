/**
 * Connectors & Model Context Protocol (MCP) Types (ADR-0014).
 * Defines the schemas for external tool providers, MCP servers, and custom connectors.
 */

export type ConnectorType = 'builtin' | 'mcp_stdio' | 'mcp_sse' | 'custom_http';

export type ConnectorCategory =
  | 'search'
  | 'security'
  | 'developer'
  | 'data'
  | 'mcp'
  | 'custom';

export type ConnectorStatus = 'ready' | 'connected' | 'error' | 'disabled';

export interface ConnectorToolParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: any;
}

export interface ConnectorTool {
  name: string;
  description: string;
  usage?: string;
  parameters?: Record<string, any> | ConnectorToolParameter[];
  inputSchema?: Record<string, any>;
  returns?: string;
}

export interface ConnectorConfig {
  /** For MCP stdio: Command executable (e.g. 'npx', 'python', 'uvx') */
  command?: string;
  /** For MCP stdio: Command line arguments (e.g. ['-y', '@modelcontextprotocol/server-filesystem', '/path']) */
  args?: string[];
  /** Environment variables passed to subprocess or HTTP request */
  env?: Record<string, string>;
  /** For MCP SSE / HTTP / Custom REST: Endpoint URL */
  url?: string;
  /** Custom HTTP Headers (e.g. Authorization, X-API-Key) */
  headers?: Record<string, string>;
  /** Optional secret API key */
  apiKey?: string;
  /** Timeout in milliseconds (default 30000) */
  timeoutMs?: number;
  [key: string]: any;
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  type: ConnectorType;
  category: ConnectorCategory;
  enabled: boolean;
  status: ConnectorStatus;
  statusMessage?: string;
  icon?: string;
  config: ConnectorConfig;
  tools: ConnectorTool[];
  createdAt: number;
  updatedAt: number;
}

export interface ConnectorTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  discoveredTools?: ConnectorTool[];
}

export interface ConnectorCatalogPreset {
  id: string;
  name: string;
  description: string;
  type: ConnectorType;
  category: ConnectorCategory;
  icon: string;
  defaultConfig: ConnectorConfig;
  defaultTools: ConnectorTool[];
}
