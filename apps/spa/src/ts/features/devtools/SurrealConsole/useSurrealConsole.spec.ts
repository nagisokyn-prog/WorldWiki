import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
