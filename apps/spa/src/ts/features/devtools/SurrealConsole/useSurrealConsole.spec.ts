import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useSurrealConsole } from './useSurrealConsole';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  executeRawSurql: vi.fn(),
}));

describe('useSurrealConsole', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with default state and presets', () => {
    const { queryInput, isLoading, history, presets, formattedOutput } = useSurrealConsole({
      project: 'test_proj',
    });

    expect(queryInput.value).toBe('');
    expect(isLoading.value).toBe(false);
    expect(history.value).toEqual([]);
    expect(presets.value.length).toBeGreaterThan(0);
    expect(formattedOutput.value).toBe('');
  });

  it('selects a preset and sets the queryInput', () => {
    const { queryInput, presets, selectPreset } = useSurrealConsole({ project: 'test_proj' });
    selectPreset(presets.value[0]);
    expect(queryInput.value).toBe(presets.value[0].query);
  });

  it('executes a query successfully and formats JSON output', async () => {
    const mockResult = [{ id: 'projects:p1', name: 'Test' }];
    vi.mocked(api.executeRawSurql).mockResolvedValueOnce(mockResult);

    const { queryInput, executeQuery, activeResult, history, formattedOutput } = useSurrealConsole({
      project: 'test_proj',
    });

    queryInput.value = 'SELECT * FROM projects;';
    await executeQuery();

    expect(api.executeRawSurql).toHaveBeenCalledWith('SELECT * FROM projects;');
    expect(activeResult.value?.success).toBe(true);
    expect(activeResult.value?.result).toEqual(mockResult);
    expect(history.value.length).toBe(1);
    expect(formattedOutput.value).toBe(JSON.stringify(mockResult, null, 2));
  });

  it('handles query execution errors gracefully', async () => {
    vi.mocked(api.executeRawSurql).mockRejectedValueOnce(new Error('Syntax error at line 1'));

    const { queryInput, executeQuery, activeResult, history, formattedOutput } = useSurrealConsole({
      project: 'test_proj',
    });

    queryInput.value = 'BAD QUERY;';
    await executeQuery();

    expect(activeResult.value?.success).toBe(false);
    expect(activeResult.value?.error).toContain('Syntax error');
    expect(history.value.length).toBe(1);
    expect(formattedOutput.value).toContain('❌ Error');
  });

  it('navigates history with navigateHistory', () => {
    const { history, queryInput, navigateHistory } = useSurrealConsole();
    history.value = [
      { id: '1', query: 'QUERY 1', timestamp: '10:00', durationMs: 5, success: true },
      { id: '2', query: 'QUERY 2', timestamp: '10:01', durationMs: 10, success: true },
    ];

    navigateHistory('up');
    expect(queryInput.value).toBe('QUERY 1');

    navigateHistory('up');
    expect(queryInput.value).toBe('QUERY 2');

    navigateHistory('down');
    expect(queryInput.value).toBe('QUERY 1');

    navigateHistory('down');
    expect(queryInput.value).toBe('');
  });

  it('clears history and local storage', () => {
    const { history, clearHistory } = useSurrealConsole();
    history.value = [{ id: '1', query: 'SELECT 1;', timestamp: '10:00', durationMs: 1, success: true }];
    clearHistory();
    expect(history.value).toEqual([]);
  });

  it('loads history on mount, handles corrupt JSON, selectHistoryItem, key handlers, and max history', async () => {
    localStorage.setItem(
      'surreal_console_history_v1',
      JSON.stringify([{ id: 'h1', query: 'INFO FOR DB;', timestamp: '10:00', durationMs: 2, success: true }])
    );
    let apiHook!: ReturnType<typeof useSurrealConsole>;
    const Comp = defineComponent({
      setup() {
        apiHook = useSurrealConsole({ project: 'projects:p1' });
        return {};
      },
      template: '<div />',
    });
    const wrapper = mount(Comp);
    expect(apiHook.history.value.length).toBe(1);
    expect(apiHook.activeResult.value?.id).toBe('h1');
    wrapper.unmount();

    localStorage.setItem('surreal_console_history_v1', '{invalid');
    const wrapperBad = mount(Comp);
    expect(apiHook.history.value).toEqual([]);
    wrapperBad.unmount();

    // Empty query guard & customQuery & non-Error catch
    await apiHook.executeQuery('   ');
    expect(api.executeRawSurql).not.toHaveBeenCalled();

    vi.mocked(api.executeRawSurql).mockRejectedValueOnce('raw error');
    await apiHook.executeQuery('SELECT 1;');
    expect(apiHook.activeResult.value?.error).toBe('raw error');

    // Fill > 50 items
    vi.mocked(api.executeRawSurql).mockResolvedValue([]);
    apiHook.history.value = Array.from({ length: 50 }, (_, i) => ({
      id: `id_${i}`,
      query: `Q${i}`,
      timestamp: '10:00',
      durationMs: 1,
      success: true,
    }));
    await apiHook.executeQuery('Q_NEW');
    expect(apiHook.history.value.length).toBe(50);

    apiHook.selectHistoryItem(apiHook.history.value[1]);
    expect(apiHook.queryInput.value).toBe('Q0');

    // handleKeyUp / handleKeyDown
    const preventDefault = vi.fn();
    apiHook.queryInput.value = '';
    apiHook.handleKeyUp({ target: { selectionStart: 0 }, preventDefault } as any);
    apiHook.queryInput.value = '';
    apiHook.handleKeyDown({ target: { selectionStart: 0 }, preventDefault } as any);
    expect(preventDefault).toHaveBeenCalledTimes(2);

    apiHook.queryInput.value = 'SELECT 1';
    apiHook.handleKeyUp({ target: { selectionStart: 3 }, preventDefault } as any);
    apiHook.handleKeyDown({ target: { selectionStart: 3 }, preventDefault } as any);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });
});
