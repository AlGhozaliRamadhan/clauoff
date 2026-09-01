/**
 * Claude & Agent Plugins Ecosystem Types (ADR-0015).
 * Follows the Claude Code and Anthropic Plugin specification.
 */

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  skills?: string[]; // Relative paths or names of bundled skills
  mcpServers?: Record<string, {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
  }>;
  hooks?: Record<string, Array<{
    type: 'command' | 'prompt';
    command?: string;
    prompt?: string;
  }>>;
  agents?: string[];
  [key: string]: any;
}

export interface BundledSkillSummary {
  name: string;
  description: string;
  path: string;
  content: string;
  instructions: string;
}

export interface BundledMcpSummary {
  name: string;
  type: 'mcp_stdio' | 'mcp_sse';
  config: Record<string, any>;
  toolsCount: number;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  category: 'development' | 'security' | 'devops' | 'data' | 'productivity' | 'custom';
  enabled: boolean;
  source: 'builtin' | 'marketplace' | 'github' | 'custom';
  sourceUrl?: string;
  manifest: PluginManifest;
  bundledSkills: BundledSkillSummary[];
  bundledMcpServers: BundledMcpSummary[];
  installedAt: number;
  updatedAt: number;
}

export interface CuratedPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'development' | 'security' | 'devops' | 'data' | 'productivity';
  tags: string[];
  homepage?: string;
  repository?: string;
  manifest: PluginManifest;
  skills: Array<{ name: string; description: string; skillMd: string }>;
  mcpServers?: Record<string, any>;
}
