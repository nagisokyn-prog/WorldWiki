import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createPromisePersister } from './usePromisePersistence';
import { plotApi } from '@/services/api/plot.api';
import type { RichPlotPromise } from './PromiseActions.model';

vi.mock('@/services/api/plot.api', () => ({
  plotApi: {
    savePlotPromise: vi.fn(),
  },
}));

describe('usePromisePersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists promise, updates returned metadata, and triggers backup & onChange', async () => {
    const promises = ref<RichPlotPromise[]>([
      { id: 'plot_promises:1', project_id: 'p1', kind: 'gun', quote: 'Q', paragraph_index: 1, status: 'planted', progressions: [], resolution: null, resolved_in_volume: null, resolved_in_chapter: null },
    ]);
    const syncLocalBackup = vi.fn();
    const onChange = vi.fn();

    vi.mocked(plotApi.savePlotPromise).mockResolvedValueOnce({
      timeline_event_id: 'ev_99',
      m_abs: 1440,
      calendar_id: 'cal_1',
    });

    const persist = createPromisePersister({
      promises,
      getProject: () => 'p1',
      getChapterId: () => 'chapters:1',
      syncLocalBackup,
      onChange,
    });

    await persist(promises.value[0], 'save test');

    expect(promises.value[0].timeline_event_id).toBe('ev_99');
    expect(promises.value[0].m_abs).toBe(1440);
    expect(promises.value[0].calendar_id).toBe('cal_1');
    expect(syncLocalBackup).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('retries on Transaction conflict and logs non-conflict errors', async () => {
    const promises = ref<RichPlotPromise[]>([
      { id: 'plot_promises:1', project_id: 'p1', kind: 'gun', quote: 'Q', paragraph_index: 1, status: 'planted', progressions: [], resolution: null, resolved_in_volume: null, resolved_in_chapter: null },
    ]);
    const syncLocalBackup = vi.fn();
    const onChange = vi.fn();

    vi.mocked(plotApi.savePlotPromise)
      .mockRejectedValueOnce(new Error('Transaction conflict'))
      .mockResolvedValueOnce(null);

    const persist = createPromisePersister({
      promises,
      getProject: () => 'p1',
      getChapterId: () => 'chapters:1',
      syncLocalBackup,
      onChange,
    });

    await persist(promises.value[0], 'retry test');
    expect(plotApi.savePlotPromise).toHaveBeenCalledTimes(2);

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(plotApi.savePlotPromise).mockRejectedValueOnce(new Error('fatal'));
    await persist(promises.value[0], 'fatal test');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
