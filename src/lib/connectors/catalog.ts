/**
 * Built-in Connectors and MCP Server Presets Catalog (ADR-0014).
 */

import type { Connector, ConnectorCatalogPreset } from './types';

export const BUILTIN_CONNECTORS: Connector[] = [
  {
    id: 'builtin-web-search',
    name: 'DuckDuckGo & Web Search',
    description: 'Real-time multi-provider web search and web page text reader with zero external API key requirements.',
    type: 'builtin',
    category: 'search',
    enabled: true,
    status: 'ready',
    icon: 'search',
    config: {},
    tools: [
      {
        name: 'search_web',
        description: 'Search the web for up-to-date information, news, versions, or facts.',
        usage: '<action name="search_web">who won nobel prize 2024</action>',
      },
      {
        name: 'fetch_web_page',
        description: 'Fetch and read the readable content or article text of any URL.',
        usage: '<action name="fetch_web_page">https://example.com/docs</action>',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-cve-explorer',
    name: 'NIST & OSV CVE Security Explorer',
    description: 'Live security vulnerability database inspector pulling CVSS scores, affected software versions, CWEs, and official mitigation advisories.',
    type: 'builtin',
    category: 'security',
    enabled: true,
    status: 'ready',
    icon: 'shield',
    config: {},
    tools: [
      {
        name: 'cve_explorer',
        description: 'Search and inspect CVE security vulnerabilities, CVSS scores, and official advisories.',
        usage: '<action name="cve_explorer">CVE-2024-3094</action>',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-python-sandbox',
    name: 'Python Subprocess Interpreter',
    description: 'Execute calculations, data manipulation, algorithm testing, and mathematical verifications in an isolated Python environment.',
    type: 'builtin',
    category: 'developer',
    enabled: true,
    status: 'ready',
    icon: 'code',
    config: {
      timeoutMs: 30000,
    },
    tools: [
      {
        name: 'run_python',
        description: 'Execute Python code in a sandboxed subprocess and return stdout/stderr.',
        usage: '<action name="run_python">print(sum([x**2 for x in range(10)]))</action>',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-filesystem',
    name: 'Workspace File Inspector',
    description: 'Safely list directories and read file contents within the project workspace or data folders.',
    type: 'builtin',
    category: 'developer',
    enabled: true,
    status: 'ready',
    icon: 'folder',
    config: {},
    tools: [
      {
        name: 'list_directory',
        description: 'List directories and files in the workspace.',
        usage: '<action name="list_directory">src/lib</action>',
      },
      {
        name: 'read_project_file',
        description: 'Read the text content of a file in the workspace.',
        usage: '<action name="read_project_file">package.json</action>',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-github',
    name: 'GitHub Source Code Explorer',
    description: 'Inspect public GitHub repositories, download raw files, and review tree structures without authentication.',
    type: 'builtin',
    category: 'developer',
    enabled: true,
    status: 'ready',
    icon: 'github',
    config: {},
    tools: [
      {
        name: 'github_fetch_repo',
        description: 'Fetch repository tree structure and file paths from a public GitHub repo.',
        usage: '<action name="github_fetch_repo">owner/repo</action>',
      },
      {
        name: 'github_read_file',
        description: 'Read a specific raw file from a GitHub repository.',
        usage: '<action name="github_read_file">owner/repo/main/README.md</action>',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const MCP_PRESETS: ConnectorCatalogPreset[] = [
  {
    id: 'mcp-filesystem',
    name: 'Local File System (MCP Stdio)',
    description: 'Official MCP file system server enabling authorized read/write access to specified local directories.',
    type: 'mcp_stdio',
    category: 'mcp',
    icon: 'folder',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './data'],
    },
    defaultTools: [
      { name: 'read_file', description: 'Read complete contents of a file' },
      { name: 'write_file', description: 'Write or overwrite file contents' },
      { name: 'list_directory', description: 'List files and directories' },
    ],
  },
  {
    id: 'mcp-github',
    name: 'GitHub Server (MCP Stdio)',
    description: 'Official GitHub MCP server supporting repos, commits, branches, issues, and pull requests via Personal Access Token.',
    type: 'mcp_stdio',
    category: 'mcp',
    icon: 'github',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: '',
      },
    },
    defaultTools: [
      { name: 'get_file_contents', description: 'Read file contents from a GitHub repository' },
      { name: 'search_repositories', description: 'Search for GitHub repositories' },
      { name: 'create_issue', description: 'Create a new issue in a repo' },
    ],
  },
  {
    id: 'mcp-postgres',
    name: 'PostgreSQL Database (MCP Stdio)',
    description: 'Official PostgreSQL MCP server providing read-only schema inspection and SQL query execution against Postgres databases.',
    type: 'mcp_stdio',
    category: 'mcp',
    icon: 'database',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:password@localhost:5432/mydb'],
    },
    defaultTools: [
      { name: 'query', description: 'Execute a read-only SQL query on the PostgreSQL database' },
      { name: 'list_tables', description: 'List all tables and schemas' },
    ],
  },
  {
    id: 'mcp-brave-search',
    name: 'Brave Search API (MCP Stdio)',
    description: 'Official Brave Search MCP server for high-speed indexed web search queries and local search.',
    type: 'mcp_stdio',
    category: 'mcp',
    icon: 'search',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: '',
      },
    },
    defaultTools: [
      { name: 'brave_web_search', description: 'Search the web using Brave Search API' },
      { name: 'brave_local_search', description: 'Search for local businesses and locations' },
    ],
  },
  {
    id: 'mcp-puppeteer',
    name: 'Puppeteer Browser Automation (MCP)',
    description: 'Headless browser automation for complex dynamic JavaScript scraping, screenshots, and interaction.',
    type: 'mcp_stdio',
    category: 'mcp',
    icon: 'globe',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
    defaultTools: [
      { name: 'puppeteer_navigate', description: 'Navigate to any URL with full JS rendering' },
      { name: 'puppeteer_screenshot', description: 'Take a screenshot of the current page' },
      { name: 'puppeteer_click', description: 'Click an element on the page' },
    ],
  },
  {
    id: 'mcp-memory',
    name: 'Knowledge Graph Memory (MCP)',
    description: 'Persistent knowledge graph memory system for tracking user facts, entities, relations, and insights across chats.',
    type: 'mcp_stdio',
    category: 'mcp',
    icon: 'sparkles',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
    defaultTools: [
      { name: 'create_entities', description: 'Create multiple new entities in the knowledge graph' },
      { name: 'create_relations', description: 'Create relations between entities' },
      { name: 'search_nodes', description: 'Search nodes in the knowledge graph' },
    ],
  },
  {
    id: 'mcp-generic-sse',
    name: 'Remote MCP Server (HTTP / SSE)',
    description: 'Connect to any remote or containerized Model Context Protocol server over Server-Sent Events (SSE).',
    type: 'mcp_sse',
    category: 'mcp',
    icon: 'cloud',
    defaultConfig: {
      url: 'http://localhost:8000/sse',
      headers: {
        Authorization: 'Bearer ',
      },
    },
    defaultTools: [],
  },
  {
    id: 'custom-http-rest',
    name: 'Custom REST API Webhook',
    description: 'Custom HTTP endpoint connector with parameterized payload formatting and header authentication.',
    type: 'custom_http',
    category: 'custom',
    icon: 'code',
    defaultConfig: {
      url: 'https://api.example.com/v1/data',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    defaultTools: [
      {
        name: 'http_request',
        description: 'Send a request to the configured REST API endpoint',
        usage: '<action name="http_request">{"query": "data"}</action>',
      },
    ],
  },
];
