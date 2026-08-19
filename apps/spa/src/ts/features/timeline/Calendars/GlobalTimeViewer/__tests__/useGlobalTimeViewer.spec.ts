import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlobalTimeViewer } from '../useGlobalTimeViewer';
import { useCalendarStore } from '../../../../../stores/calendar.store';
import { useShellStore } from '../../../../../stores/shell';
import { invoke } from '@worldwiki/components';

vi.mock('../../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      { id: 'cal1', name: 'Cal 1', data: { name: 'Cal 1' } },
    ]),
  }),
}));

vi.mock('../../../../../stores/shell', () => ({
  useShellStore: () => ({
    projectName: 'proj1',
  }),
}));

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn().mockResolvedValue({ year: 100, month: 1, day: 5 }),
}));

describe('useGlobalTimeViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens, closes and converts time', async () => {
    const viewer = useGlobalTimeViewer();

    viewer.open();
    expect(viewer.isVisible.value).toBe(true);

    viewer.minute.value = 1000;
    await Promise.resolve();

    expect(viewer.minute.value).toBe(1000);

    viewer.close();
    expect(viewer.isVisible.value).toBe(false);
  });
});
