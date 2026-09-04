/**
 * Universal GitHub & URL Downloader for Claude Plugins (ADR-0015).
 */

import fs from 'fs';
import path from 'path';
import { getPluginsDirectory, getPlugin, sanitizePluginId, resolveSafePluginPath } from './storage';
import { saveSkill } from '@/lib/skills/storage';
import { sanitizeSkillName } from '@/lib/skills/parser';
import { saveConnector } from '@/lib/connectors/storage';
import type { Plugin, PluginManifest } from './types';

const GITHUB_IDENTIFIER_REGEX = /^[a-zA-Z0-9_.-]+$/;

export async function downloadPluginFromUrl(urlInput: string, customNameOverride?: string): Promise<Plugin> {
  const cleanUrl = urlInput.trim();
  let owner = '';
  let repo = '';
  let branch = 'main';

  // Parse GitHub repository URL
  const ghMatch = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/i);
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

  if (!GITHUB_IDENTIFIER_REGEX.test(owner) || !GITHUB_IDENTIFIER_REGEX.test(repo) || !GITHUB_IDENTIFIER_REGEX.test(branch)) {
    throw new Error('Invalid characters in GitHub repository or branch name.');
  }

  const safeOwner = encodeURIComponent(owner);
  const safeRepo = encodeURIComponent(repo);
  const safeBranch = encodeURIComponent(branch);

  const rawPluginId = customNameOverride?.trim() || repo;
  const pluginId = sanitizePluginId(rawPluginId);
  const pluginsDir = getPluginsDirectory();
  const pluginPath = resolveSafePluginPath(pluginsDir, pluginId);

  // 1. Fetch plugin.json
  const manifestUrls = [
    `https://raw.githubusercontent.com/${safeOwner}/${safeRepo}/${safeBranch}/.claude-plugin/plugin.json`,
    `https://raw.githubusercontent.com/${safeOwner}/${safeRepo}/${safeBranch}/plugin.json`,
    `https://raw.githubusercontent.com/${safeOwner}/${safeRepo}/${safeBranch}/package.json`,
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
  const claudePluginDir = resolveSafePluginPath(pluginPath, '.claude-plugin');
  fs.mkdirSync(claudePluginDir, { recursive: true });
  fs.writeFileSync(
    resolveSafePluginPath(claudePluginDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  try {
    const treeRes = await fetch(`https://api.github.com/repos/${safeOwner}/${safeRepo}/git/trees/${safeBranch}?recursive=1`, {
      headers: { 'User-Agent': 'Cogito-Plugin-Installer' },
    });

    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const tree = Array.isArray(treeData.tree) ? treeData.tree : [];

      // Look for SKILL.md files
      const skillFiles = tree.filter((item: any) => typeof item?.path === 'string' && item.path.endsWith('SKILL.md') && !item.path.includes('..'));
      for (const sf of skillFiles) {
        const safeSubPath = String(sf.path).split('/').map(encodeURIComponent).join('/');
        const rawSkillUrl = `https://raw.githubusercontent.com/${safeOwner}/${safeRepo}/${safeBranch}/${safeSubPath}`;
        const skillRes = await fetch(rawSkillUrl, { headers: { 'User-Agent': 'Cogito-Plugin-Installer' } });
        if (skillRes.ok) {
          const content = await skillRes.text();
          const rawSkillDirName = path.basename(path.dirname(sf.path)) || pluginId;
          const skillDirName = sanitizeSkillName(rawSkillDirName);
          const targetDir = resolveSafePluginPath(pluginPath, 'skills', skillDirName);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(resolveSafePluginPath(targetDir, 'SKILL.md'), content, 'utf-8');

          // Register in skills
          await saveSkill({ name: skillDirName, content, source: 'github' });
        }
      }

      // Look for .mcp.json
      const mcpFile = tree.find((item: any) => typeof item?.path === 'string' && item.path.endsWith('.mcp.json') && !item.path.includes('..'));
      if (mcpFile) {
        const safeMcpSubPath = String(mcpFile.path).split('/').map(encodeURIComponent).join('/');
        const rawMcpUrl = `https://raw.githubusercontent.com/${safeOwner}/${safeRepo}/${safeBranch}/${safeMcpSubPath}`;
        const mcpRes = await fetch(rawMcpUrl, { headers: { 'User-Agent': 'Cogito-Plugin-Installer' } });
        if (mcpRes.ok) {
          const mcpData = await mcpRes.json();
          if (mcpData.mcpServers) {
            for (const [name, config] of Object.entries<any>(mcpData.mcpServers)) {
              const safeMcpName = sanitizePluginId(name);
              await saveConnector({
                id: `plugin-${pluginId}-${safeMcpName}`,
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
  fs.writeFileSync(resolveSafePluginPath(pluginPath, '.cogito-plugin-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  const plugin = await getPlugin(pluginId);
  return plugin!;
}
