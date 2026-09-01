import { describe, it, expect } from 'vitest';
import { testConnectorConnection } from '@/lib/connectors/mcp-client';
import type { Connector } from '@/lib/connectors/types';

describe('MCP Client', () => {
  it('tests built-in connector connection immediately', async () => {
    const builtin: Connector = {
      id: 'builtin-web-search',
      name: 'DuckDuckGo & Web Search',
      description: 'Web search',
      type: 'builtin',
      category: 'search',
      enabled: true,
      status: 'ready',
      config: {},
      tools: [{ name: 'search_web', description: 'Search the web' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const res = await testConnectorConnection(builtin);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Built-in connector');
    expect(res.discoveredTools?.length).toBe(1);
  });

  it('fails gracefully on invalid stdio command', async () => {
    const invalidConnector: Connector = {
      id: 'invalid-mcp',
      name: 'Invalid MCP',
      description: 'Non-existent command',
      type: 'mcp_stdio',
      category: 'mcp',
      enabled: true,
      status: 'ready',
      config: {
        command: 'non_existent_binary_12345_xyz',
        args: [],
        timeoutMs: 2000,
      },
      tools: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const res = await testConnectorConnection(invalidConnector);
    expect(res.success).toBe(false);
    expect(res.message).toBeDefined();
  });
});
