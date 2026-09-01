import { describe, it, expect } from 'vitest';
import { getDynamicConnectorTools } from '@/lib/connectors/registry';
import { getAllActiveTools } from '@/lib/agent/tools';

describe('Connectors Tool Registry', () => {
  it('loads dynamic tools from active connectors', async () => {
    const dynamicTools = await getDynamicConnectorTools();
    expect(dynamicTools.length).toBeGreaterThan(0);

    const names = dynamicTools.map((t) => t.name);
    expect(names).toContain('search_web');
    expect(names).toContain('cve_explorer');
    expect(names).toContain('run_python');
    expect(names).toContain('list_directory');
  });

  it('resolves all active tools combining built-in core and connector tools', async () => {
    const activeTools = await getAllActiveTools();
    expect(activeTools.length).toBeGreaterThanOrEqual(5);

    const searchWeb = activeTools.find((t) => t.name === 'search_web');
    expect(searchWeb).toBeDefined();
    expect(typeof searchWeb?.execute).toBe('function');
  });

  it('executes list_directory tool safely', async () => {
    const dynamicTools = await getDynamicConnectorTools();
    const listDirTool = dynamicTools.find((t) => t.name === 'list_directory');
    expect(listDirTool).toBeDefined();

    const res = await listDirTool!.execute('.');
    expect(res.modelContext).toContain('package.json');
    expect(res.status?.label).toContain('List directory');
  });

  it('executes read_project_file tool safely', async () => {
    const dynamicTools = await getDynamicConnectorTools();
    const readFileTool = dynamicTools.find((t) => t.name === 'read_project_file');
    expect(readFileTool).toBeDefined();

    const res = await readFileTool!.execute('package.json');
    expect(res.modelContext).toContain('cogito');
  });
});
