/**
 * Claude Plugins Storage & Package Manager (ADR-0015).
 * Stores installed plugins under data/plugins/<plugin-id>/.
 */

import fs from 'fs';
import path from 'path';
import { getDataRoot } from '@/lib/rag/paths';
import type { Plugin, PluginManifest, BundledSkillSummary, BundledMcpSummary } from './types';
import { CURATED_PLUGINS } from './catalog';
import { saveSkill, deleteSkill, toggleSkill } from '@/lib/skills/storage';
import { saveConnector, deleteConnector, toggleConnector } from '@/lib/connectors/storage';

const PLUGINS_DIR_NAME = 'plugins';

export function getPluginsDirectory(): string {
  const dir = path.join(getDataRoot(), PLUGINS_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function sanitizePluginId(id: string): string {
  if (!id || typeof id !== 'string') return 'unnamed-plugin';
  let sanitized = id.toLowerCase().trim().replace(/[^a-z0-9_\-]/g, '-');
  while (sanitized.startsWith('-')) sanitized = sanitized.slice(1);
  while (sanitized.endsWith('-')) sanitized = sanitized.slice(0, -1);
  return sanitized.slice(0, 64) || 'unnamed-plugin';
}

export function resolveSafePluginPath(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir);
  const target = path.resolve(resolvedBase, ...segments);
  const relative = path.relative(resolvedBase, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid plugin path: path traversal detected');
  }
  return target;
}

/**
 * Lists all installed plugins from data/plugins/.
 */
export async function listPlugins(): Promise<Plugin[]> {
  const pluginsDir = getPluginsDirectory();
  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  const plugins: Plugin[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const safeDir = resolveSafePluginPath(pluginsDir, entry.name);
      const plugin = await readPluginFromDirectory(safeDir, entry.name);
      if (plugin) {
        plugins.push(plugin);
      }
    }
  }

  // Sort by name
  return plugins.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Reads a single plugin from its directory.
 */
export async function getPlugin(id: string): Promise<Plugin | null> {
  const safeId = sanitizePluginId(id);
  const pluginsDir = getPluginsDirectory();
  const pluginPath = resolveSafePluginPath(pluginsDir, safeId);
  if (!fs.existsSync(pluginPath)) return null;

  return readPluginFromDirectory(pluginPath, safeId);
}

async function readPluginFromDirectory(pluginPath: string, id: string): Promise<Plugin | null> {
  let manifest: PluginManifest;

  // Check .claude-plugin/plugin.json or plugin.json
  const claudePluginJson = resolveSafePluginPath(pluginPath, '.claude-plugin', 'plugin.json');
  const rootPluginJson = resolveSafePluginPath(pluginPath, 'plugin.json');
  const manifestPath = fs.existsSync(claudePluginJson)
    ? claudePluginJson
    : rootPluginJson;

  if (fs.existsSync(manifestPath)) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    // Infer default manifest
    manifest = {
      name: id,
      version: '1.0.0',
      description: `Plugin ${id}`,
    };
  }

  // Read bundled skills
  const bundledSkills: BundledSkillSummary[] = [];
  const skillsDir = resolveSafePluginPath(pluginPath, 'skills');
  if (fs.existsSync(skillsDir)) {
    const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const skillEntry of skillEntries) {
      if (skillEntry.isDirectory()) {
        const skillMdPath = resolveSafePluginPath(skillsDir, skillEntry.name, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, 'utf-8');
          bundledSkills.push({
            name: skillEntry.name,
            description: `Bundled skill: ${skillEntry.name}`,
            path: skillMdPath,
            content,
            instructions: content.replace(/^---[\s\S]*?---\n*/, '').trim(),
          });
        }
      }
    }
  }

  // Read bundled MCP servers
  const bundledMcpServers: BundledMcpSummary[] = [];
  if (manifest.mcpServers) {
    for (const [name, config] of Object.entries(manifest.mcpServers)) {
      bundledMcpServers.push({
        name,
        type: config.url ? 'mcp_sse' : 'mcp_stdio',
        config,
        toolsCount: 2,
      });
    }
  }

  // Read meta.json for enabled status and timestamps
  let enabled = true;
  let installedAt = Date.now();
  let updatedAt = Date.now();
  let source: Plugin['source'] = 'custom';
  let sourceUrl: string | undefined = undefined;

  const metaPath = resolveSafePluginPath(pluginPath, '.cogito-plugin-meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.enabled !== undefined) enabled = meta.enabled;
      if (meta.installedAt) installedAt = meta.installedAt;
      if (meta.updatedAt) updatedAt = meta.updatedAt;
      if (meta.source) source = meta.source;
      if (meta.sourceUrl) sourceUrl = meta.sourceUrl;
    } catch {
      // ignore
    }
  }

  let category: Plugin['category'] = 'development';
  if (id.includes('security') || manifest.name.includes('security')) category = 'security';
  else if (id.includes('devops') || id.includes('docker') || id.includes('cloud')) category = 'devops';
  else if (id.includes('data') || id.includes('sql') || id.includes('postgres')) category = 'data';
  else if (id.includes('test') || id.includes('qa')) category = 'productivity';

  return {
    id,
    name: manifest.name || id,
    version: manifest.version || '1.0.0',
    description: manifest.description || '',
    author: manifest.author,
    license: manifest.license,
    repository: manifest.repository,
    homepage: manifest.homepage,
    category,
    enabled,
    source,
    sourceUrl,
    manifest,
    bundledSkills,
    bundledMcpServers,
    installedAt,
    updatedAt,
  };
}

/**
 * Installs a curated plugin from the marketplace.
 */
export async function installCuratedPlugin(id: string): Promise<Plugin> {
  const safeId = sanitizePluginId(id);
  const curated = CURATED_PLUGINS.find((p) => p.id === safeId || p.id === id);
  if (!curated) {
    throw new Error(`Curated plugin "${id}" not found.`);
  }

  const pluginsDir = getPluginsDirectory();
  const pluginPath = resolveSafePluginPath(pluginsDir, curated.id);

  // 1. Create plugin directory structure
  fs.mkdirSync(resolveSafePluginPath(pluginPath, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(resolveSafePluginPath(pluginPath, 'skills'), { recursive: true });

  // 2. Write manifest
  fs.writeFileSync(
    resolveSafePluginPath(pluginPath, '.claude-plugin', 'plugin.json'),
    JSON.stringify(curated.manifest, null, 2),
    'utf-8'
  );

  // 3. Write and register bundled skills
  for (const skill of curated.skills) {
    const skillDir = resolveSafePluginPath(pluginPath, 'skills', skill.name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(resolveSafePluginPath(skillDir, 'SKILL.md'), skill.skillMd, 'utf-8');

    // Register into Cogito Skills system
    await saveSkill({ name: skill.name, content: skill.skillMd, source: 'builtin' });
  }

  // 4. Register bundled MCP servers if any
  if (curated.mcpServers) {
    for (const [name, config] of Object.entries(curated.mcpServers)) {
      await saveConnector({
        id: `plugin-${curated.id}-${name}`,
        name: `${curated.name} (${name})`,
        description: `MCP Server provided by plugin "${curated.name}"`,
        type: config.url ? 'mcp_sse' : 'mcp_stdio',
        category: 'mcp',
        enabled: true,
        config,
      });
    }
  }

  // 5. Write metadata
  const meta = {
    enabled: true,
    source: 'marketplace',
    sourceUrl: curated.repository,
    installedAt: Date.now(),
    updatedAt: Date.now(),
  };
  fs.writeFileSync(resolveSafePluginPath(pluginPath, '.cogito-plugin-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  const plugin = await getPlugin(curated.id);
  return plugin!;
}

/**
 * Toggles a plugin enabled state and syncs bundled skills/connectors.
 */
export async function togglePlugin(id: string, enabled: boolean): Promise<Plugin | null> {
  const safeId = sanitizePluginId(id);
  const plugin = await getPlugin(safeId);
  if (!plugin) return null;

  const pluginsDir = getPluginsDirectory();
  const pluginPath = resolveSafePluginPath(pluginsDir, safeId);

  const metaPath = resolveSafePluginPath(pluginPath, '.cogito-plugin-meta.json');
  const meta = {
    enabled,
    source: plugin.source,
    sourceUrl: plugin.sourceUrl,
    installedAt: plugin.installedAt,
    updatedAt: Date.now(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  // Sync bundled skills
  for (const skill of plugin.bundledSkills) {
    await toggleSkill(skill.name, enabled).catch(() => {});
  }

  // Sync bundled connectors
  for (const mcp of plugin.bundledMcpServers) {
    await toggleConnector(`plugin-${plugin.id}-${mcp.name}`, enabled).catch(() => {});
  }

  return getPlugin(safeId);
}

/**
 * Deletes a plugin and unregisters its bundled skills and connectors.
 */
export async function deletePlugin(id: string): Promise<boolean> {
  const safeId = sanitizePluginId(id);
  const plugin = await getPlugin(safeId);
  if (!plugin) return false;

  // 1. Unregister bundled skills
  for (const skill of plugin.bundledSkills) {
    await deleteSkill(skill.name).catch(() => {});
  }

  // 2. Unregister bundled connectors
  for (const mcp of plugin.bundledMcpServers) {
    await deleteConnector(`plugin-${plugin.id}-${mcp.name}`).catch(() => {});
  }

  // 3. Remove plugin directory
  const pluginsDir = getPluginsDirectory();
  const pluginPath = resolveSafePluginPath(pluginsDir, safeId);
  if (fs.existsSync(pluginPath)) {
    fs.rmSync(pluginPath, { recursive: true, force: true });
  }

  return true;
}
