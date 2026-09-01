import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureBuiltinConnectors,
  listConnectors,
  getConnector,
  saveConnector,
  toggleConnector,
  deleteConnector,
} from '@/lib/connectors/storage';

describe('Connectors Storage', () => {
  beforeEach(() => {
    ensureBuiltinConnectors();
  });

  it('initializes default built-in connectors', async () => {
    const list = await listConnectors();
    expect(list.length).toBeGreaterThanOrEqual(5);

    const webSearch = list.find((c) => c.id === 'builtin-web-search');
    expect(webSearch).toBeDefined();
    expect(webSearch?.type).toBe('builtin');
    expect(webSearch?.enabled).toBe(true);

    const cveExplorer = list.find((c) => c.id === 'builtin-cve-explorer');
    expect(cveExplorer).toBeDefined();
    expect(cveExplorer?.tools.some((t) => t.name === 'cve_explorer')).toBe(true);
  });

  it('retrieves connector by ID', async () => {
    const connector = await getConnector('builtin-python-sandbox');
    expect(connector).toBeDefined();
    expect(connector?.name).toContain('Python');
  });

  it('creates and saves a custom connector', async () => {
    const created = await saveConnector({
      name: 'Custom Test MCP Server',
      description: 'A test connector',
      type: 'mcp_stdio',
      category: 'mcp',
      config: {
        command: 'node',
        args: ['-v'],
      },
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Custom Test MCP Server');

    const fetched = await getConnector(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Custom Test MCP Server');

    // Clean up
    await deleteConnector(created.id);
  });

  it('toggles connector enabled state', async () => {
    const toggled = await toggleConnector('builtin-web-search', false);
    expect(toggled?.enabled).toBe(false);

    // Restore
    await toggleConnector('builtin-web-search', true);
  });

  it('protects built-in connectors from deletion', async () => {
    await expect(deleteConnector('builtin-web-search')).rejects.toThrow(
      'Built-in connectors cannot be deleted.'
    );
  });
});
