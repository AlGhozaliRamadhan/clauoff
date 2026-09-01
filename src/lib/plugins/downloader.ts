/**
 * Universal GitHub & URL Downloader for Claude Plugins (ADR-0015).
 */

import fs from 'fs';
import path from 'path';
import { getPluginsDirectory, getPlugin } from './storage';
import { saveSkill } from '@/lib/skills/storage';
import { saveConnector } from '@/lib/connectors/storage';
import type { Plugin, PluginManifest } from './types';

export async function downloadPluginFromUrl(urlInput: string, customNameOverride?: string): Promise<Plugin> {
  const cleanUrl = urlInput.trim();
  let owner = '';
  let repo = '';
  let branch = 'main';

  // Parse GitHub repository URL
  const ghMatch = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/);
  if (ghMatch) {
    owner = ghMatch[1];
    repo = ghMatch[2].replace(/\.git$/, '');
    branch = ghMatch[3] || 'main';
  } else if (/^[^/]+\/[^/]+$/.test(cleanUrl)) {
    const parts = cleanUrl.split('/');
    owner = parts[0];
    repo = parts[1];
  } else {
    throw new Error('Please provide a valid GitHub repository URL (e.g. https://github.com/owner/repo or owner/repo).');
  }

  const pluginId = customNameOverride?.trim().toLowerCase() || repo.toLowerCase();
  const pluginsDir = getPluginsDirectory();
  const pluginPath = path.join(pluginsDir, pluginId);

  // 1. Fetch plugin.json
  const manifestUrls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.claude-plugin/plugin.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugin.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`,
  ];

  let manifest: PluginManifest | null = null;
  for (const mUrl of manifestUrls) {
    try {
      const res = await fetch(mUrl, { headers: { 'User-Agent': 'Cogito-Plugin-Installer' } });
      if (res.ok) {
        manifest = await res.json();
        break;
      }
    } catch {
      // try next
    }
  }

  if (!manifest) {
    manifest = {
      name: pluginId,
      version: '1.0.0',
      description: `Plugin downloaded from ${owner}/${repo}`,
      repository: `https://github.com/${owner}/${repo}`,
    };
  }

  // 2. Fetch repository tree to discover skills and MCP servers
  fs.mkdirSync(path.join(pluginPath, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginPath, '.claude-plugin', 'plugin.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  try {
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
      headers: { 'User-Agent': 'Cogito-Plugin-Installer' },
    });

    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const tree = treeData.tree || [];

      // Look for SKILL.md files
      const skillFiles = tree.filter((item: any) => item.path && item.path.endsWith('SKILL.md'));
      for (const sf of skillFiles) {
        const rawSkillUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sf.path}`;
        const skillRes = await fetch(rawSkillUrl, { headers: { 'User-Agent': 'Cogito-Plugin-Installer' } });
        if (skillRes.ok) {
          const content = await skillRes.text();
          const skillDirName = path.basename(path.dirname(sf.path)) || pluginId;
          const targetDir = path.join(pluginPath, 'skills', skillDirName);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'SKILL.md'), content, 'utf-8');

          // Register in skills
          await saveSkill({ name: skillDirName, content, source: 'github' });
        }
      }

      // Look for .mcp.json
      const mcpFile = tree.find((item: any) => item.path && item.path.endsWith('.mcp.json'));
      if (mcpFile) {
        const rawMcpUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${mcpFile.path}`;
        const mcpRes = await fetch(rawMcpUrl, { headers: { 'User-Agent': 'Cogito-Plugin-Installer' } });
        if (mcpRes.ok) {
          const mcpData = await mcpRes.json();
          if (mcpData.mcpServers) {
            for (const [name, config] of Object.entries<any>(mcpData.mcpServers)) {
              await saveConnector({
                id: `plugin-${pluginId}-${name}`,
                name: `${manifest.name || pluginId} (${name})`,
                description: `MCP Server from plugin ${pluginId}`,
                type: config.url ? 'mcp_sse' : 'mcp_stdio',
                category: 'mcp',
                enabled: true,
                config,
              });
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal if tree fails
  }

  // 3. Write metadata
  const meta = {
    enabled: true,
    source: 'github',
    sourceUrl: `https://github.com/${owner}/${repo}`,
    installedAt: Date.now(),
    updatedAt: Date.now(),
  };
  fs.writeFileSync(path.join(pluginPath, '.cogito-plugin-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  const plugin = await getPlugin(pluginId);
  return plugin!;
}
