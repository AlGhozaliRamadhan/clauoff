import { describe, it, expect } from 'vitest';
import { listPlugins, getPlugin, installCuratedPlugin, togglePlugin, deletePlugin } from '@/lib/plugins/storage';
import { CURATED_PLUGINS } from '@/lib/plugins/catalog';

describe('Plugins Storage & Package Manager', () => {
  it('has valid curated plugins defined in catalog', () => {
    expect(CURATED_PLUGINS.length).toBeGreaterThanOrEqual(4);
    for (const plugin of CURATED_PLUGINS) {
      expect(plugin.id).toBeDefined();
      expect(plugin.name).toBeDefined();
      expect(plugin.manifest).toBeDefined();
      expect(plugin.skills.length).toBeGreaterThan(0);
    }
  });

  it('installs a curated plugin and verifies bundled skills', async () => {
    const installed = await installCuratedPlugin('security-sentinel');
    expect(installed).toBeDefined();
    expect(installed.id).toBe('security-sentinel');
    expect(installed.enabled).toBe(true);
    expect(installed.bundledSkills.length).toBeGreaterThan(0);

    const fetched = await getPlugin('security-sentinel');
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Security Sentinel Suite');

    const plugins = await listPlugins();
    expect(plugins.some((p) => p.id === 'security-sentinel')).toBe(true);
  });

  it('toggles plugin enabled status', async () => {
    const toggled = await togglePlugin('security-sentinel', false);
    expect(toggled?.enabled).toBe(false);

    const restored = await togglePlugin('security-sentinel', true);
    expect(restored?.enabled).toBe(true);
  });

  it('deletes plugin cleanly', async () => {
    const deleted = await deletePlugin('security-sentinel');
    expect(deleted).toBe(true);

    const fetched = await getPlugin('security-sentinel');
    expect(fetched).toBeNull();
  });
});
