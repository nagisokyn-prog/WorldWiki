import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiToolInspector } from '../components/useAiToolInspector';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('useAiToolInspector', () => {
  let emit: (e: 'close' | 'insert-context', ...args: unknown[]) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
  });

  it('initializes with default query_world state', () => {
    const inspector = useAiToolInspector({ currentProject: 'projects:test', isOpen: true }, emit);
    expect(inspector.selectedTool.value).toBe('query_world');
    expect(inspector.queryInput.value).toBe('Лёха');
    expect(inspector.scopeInput.value).toBe('all');
    expect(inspector.isLoading.value).toBe(false);
    expect(inspector.resultJson.value).toBeNull();
  });

  it('executes query_world tool successfully and sets resultJson', async () => {
    const inspector = useAiToolInspector({ currentProject: 'projects:test', isOpen: true }, emit);
    const mockResponse = { results: [{ id: 'entities:1', name: 'Лёха' }] };
    vi.mocked(invoke).mockResolvedValue(mockResponse);

    await inspector.executeTool();

    expect(invoke).toHaveBeenCalledWith('execute_ai_tool_direct', {
      project: 'projects:test',
      toolName: 'query_world',
      toolInput: {
        query: 'Лёха',
        scope: 'all',
        top_k: 8,
      },
    });
    expect(inspector.isLoading.value).toBe(false);
    expect(inspector.resultJson.value).toBe(JSON.stringify(mockResponse, null, 2));
    expect(inspector.resultError.value).toBeNull();
    expect(typeof inspector.executionTimeMs.value).toBe('number');
  });

  it('handles inspect_entity tool execution', async () => {
    const inspector = useAiToolInspector({ currentProject: 'projects:test', isOpen: true }, emit);
    inspector.selectedTool.value = 'inspect_entity';
    inspector.queryInput.value = 'Лёха';

    const mockResponse = { id: 'entities:1', name: 'Лёха', description: 'Друг детства' };
    vi.mocked(invoke).mockResolvedValue(mockResponse);

    await inspector.executeTool();

    expect(invoke).toHaveBeenCalledWith('execute_ai_tool_direct', {
      project: 'projects:test',
      toolName: 'inspect_entity',
      toolInput: {
        entity_id_or_name: 'Лёха',
      },
    });
    expect(inspector.resultJson.value).toBe(JSON.stringify(mockResponse, null, 2));
  });

  it('handles read_manuscript tool execution', async () => {
    const inspector = useAiToolInspector({ currentProject: 'projects:test', isOpen: true }, emit);
    inspector.selectedTool.value = 'read_manuscript';
    inspector.queryInput.value = 'chapter_1';

    const mockResponse = { title: 'Глава 1', content: 'Текст главы' };
    vi.mocked(invoke).mockResolvedValue(mockResponse);

    await inspector.executeTool();

    expect(invoke).toHaveBeenCalledWith('execute_ai_tool_direct', {
      project: 'projects:test',
      toolName: 'read_manuscript',
      toolInput: {
        chapter_id: 'chapter_1',
      },
    });
    expect(inspector.resultJson.value).toBe(JSON.stringify(mockResponse, null, 2));
  });

  it('handles tool execution error gracefully', async () => {
    const inspector = useAiToolInspector({ currentProject: 'projects:test', isOpen: true }, emit);
    vi.mocked(invoke).mockRejectedValue(new Error('Backend error'));

    await inspector.executeTool();

    expect(inspector.isLoading.value).toBe(false);
    expect(inspector.resultError.value).toContain('Backend error');
    expect(inspector.resultJson.value).toBeNull();
  });

  it('emits insert-context and close on insertIntoContext', () => {
    const inspector = useAiToolInspector({ currentProject: 'projects:test', isOpen: true }, emit);
    inspector.resultJson.value = '{"test": 123}';

    inspector.insertIntoContext();

    expect(emit).toHaveBeenCalledWith('insert-context', expect.stringContaining('{"test": 123}'));
    expect(emit).toHaveBeenCalledWith('close');
  });

  it('emits close on closeModal', () => {
    const inspector = useAiToolInspector({ currentProject: 'projects:test', isOpen: true }, emit);
    inspector.closeModal();
    expect(emit).toHaveBeenCalledWith('close');
  });
});
