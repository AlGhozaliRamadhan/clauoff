/**
 * Connectors disk persistence and state manager (ADR-0014).
 * Stores connectors configuration under data/connectors.json.
 */

import fs from 'fs';
import path from 'path';
import { getDataRoot } from '@/lib/rag/paths';
import type { Connector, ConnectorTestResult } from './types';
import { BUILTIN_CONNECTORS } from './catalog';
import { testConnectorConnection, discoverMcpTools } from './mcp-client';

const CONNECTORS_FILE_NAME = 'connectors.json';

function getConnectorsFilePath(): string {
  const dir = getDataRoot();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, CONNECTORS_FILE_NAME);
}

interface StoredConnectorsConfig {
  version: 1;
  connectors: Connector[];
}

/**
 * Initializes and merges built-in connectors with user storage.
 */
export function ensureBuiltinConnectors(): Connector[] {
  const filePath = getConnectorsFilePath();

  let storedList: Connector[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed: StoredConnectorsConfig = JSON.parse(raw);
      if (Array.isArray(parsed.connectors)) {
        storedList = parsed.connectors;
      }
    } catch {
      storedList = [];
    }
  }

  // Merge built-in connectors
  const map = new Map<string, Connector>();
  for (const builtin of BUILTIN_CONNECTORS) {
    map.set(builtin.id, builtin);
  }

  for (const stored of storedList) {
    // Preserve custom or updated states
    if (map.has(stored.id)) {
      const existing = map.get(stored.id)!;
      map.set(stored.id, {
        ...existing,
        ...stored,
        tools: existing.tools, // keep tool definitions authoritative for built-in
      });
    } else {
      map.set(stored.id, stored);
    }
  }

  const merged = Array.from(map.values());
  saveConnectorsFile(merged);
  return merged;
}

function saveConnectorsFile(connectors: Connector[]): void {
  const filePath = getConnectorsFilePath();
  const data: StoredConnectorsConfig = {
    version: 1,
    connectors,
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Returns all configured connectors.
 */
export async function listConnectors(): Promise<Connector[]> {
  return ensureBuiltinConnectors();
}

/**
 * Gets a specific connector by ID.
 */
export async function getConnector(id: string): Promise<Connector | null> {
  const list = await listConnectors();
  return list.find((c) => c.id === id) || null;
}

/**
 * Saves (creates or updates) a connector.
 */
export async function saveConnector(
  connectorData: Partial<Connector> & { name: string; type: Connector['type'] }
): Promise<Connector> {
  const list = await listConnectors();
  const id = connectorData.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  const existingIndex = list.findIndex((c) => c.id === id);
  let connector: Connector;

  if (existingIndex >= 0) {
    connector = {
      ...list[existingIndex],
      ...connectorData,
      id,
      updatedAt: now,
    };
    list[existingIndex] = connector;
  } else {
    connector = {
      id,
      name: connectorData.name,
      description: connectorData.description || '',
      type: connectorData.type,
      category: connectorData.category || 'custom',
      enabled: connectorData.enabled !== undefined ? connectorData.enabled : true,
      status: 'ready',
      icon: connectorData.icon || 'code',
      config: connectorData.config || {},
      tools: connectorData.tools || [],
      createdAt: now,
      updatedAt: now,
    };
    list.push(connector);
  }

  // If it's an MCP server, attempt to discover its live tools automatically
  if ((connector.type === 'mcp_stdio' || connector.type === 'mcp_sse') && (!connector.tools || connector.tools.length === 0)) {
    try {
      const discovered = await discoverMcpTools({
        ...connector,
        config: { ...connector.config, timeoutMs: 1500 },
      });
      if (discovered.length > 0) {
        connector.tools = discovered;
        connector.status = 'connected';
      }
    } catch (err) {
      connector.status = 'ready';
      connector.statusMessage = err instanceof Error ? err.message : String(err);
    }
  }

  saveConnectorsFile(list);
  return connector;
}

/**
 * Toggles enabled state of a connector.
 */
export async function toggleConnector(id: string, enabled: boolean): Promise<Connector | null> {
  const list = await listConnectors();
  const connector = list.find((c) => c.id === id);
  if (!connector) return null;

  connector.enabled = enabled;
  connector.updatedAt = Date.now();
  saveConnectorsFile(list);
  return connector;
}

/**
 * Deletes a custom connector. Built-in connectors cannot be deleted.
 */
export async function deleteConnector(id: string): Promise<boolean> {
  if (id.startsWith('builtin-')) {
    throw new Error('Built-in connectors cannot be deleted.');
  }

  const list = await listConnectors();
  const filtered = list.filter((c) => c.id !== id);
  if (filtered.length === list.length) return false;

  saveConnectorsFile(filtered);
  return true;
}

/**
 * Tests connection to a connector.
 */
export async function testConnector(id: string): Promise<ConnectorTestResult> {
  const connector = await getConnector(id);
  if (!connector) {
    return {
      success: false,
      message: `Connector with ID "${id}" not found.`,
    };
  }

  const result = await testConnectorConnection(connector);

  // Update connector live status
  const list = await listConnectors();
  const c = list.find((item) => item.id === id);
  if (c) {
    c.status = result.success ? (c.type === 'builtin' ? 'ready' : 'connected') : 'error';
    c.statusMessage = result.message;
    if (result.discoveredTools && result.discoveredTools.length > 0) {
      c.tools = result.discoveredTools;
    }
    saveConnectorsFile(list);
  }

  return result;
}
