import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExportModal } from '../useExportModal';
import { appAlert } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
}));

describe('useExportModal', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      allChapters: [
        { id: 'ch_1', title: 'Chapter 1' },
        { id: 'ch_2', title: 'Chapter 2' },
      ],
      currentChapterId: 'ch_1',
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects and clears all chapters', () => {
    const modal = useExportModal(props, emit);

    modal.selectAll();
    expect(modal.selectedChapters.value).toEqual(['ch_1', 'ch_2']);

    modal.clearSelection();
    expect(modal.selectedChapters.value).toEqual([]);
  });

  it('exports with mode "current" and closes after timeout', async () => {
    const modal = useExportModal(props, emit);
    modal.selectionMode.value = 'current';

    await modal.exportData();

    expect(modal.loading.value).toBe(true);
    expect(emit).toHaveBeenCalledWith('export', {
      format: 'txt',
      chapterIds: ['ch_1'],
      options: {
        addTOC: true,
        addPageNumbers: true,
        includeMetadata: true,
      },
    });

    vi.advanceTimersByTime(1000);
    expect(modal.loading.value).toBe(false);
    expect(emit).toHaveBeenCalledWith('close');
  });

  it('exports with mode "all"', async () => {
    const modal = useExportModal(props, emit);
    modal.selectionMode.value = 'all';

    await modal.exportData();
    expect(emit).toHaveBeenCalledWith('export', expect.objectContaining({
      chapterIds: ['ch_1', 'ch_2'],
    }));
  });

  it('exports with mode "custom" and alerts when no chapters selected', async () => {
    const modal = useExportModal(props, emit);
    modal.selectionMode.value = 'custom';
    modal.selectedChapters.value = [];

    await modal.exportData();
    expect(appAlert).toHaveBeenCalledWith('Не выбраны главы для экспорта');
    expect(emit).not.toHaveBeenCalledWith('export', expect.anything());

    // With custom chapters selected
    modal.selectedChapters.value = ['ch_2'];
    await modal.exportData();
    expect(emit).toHaveBeenCalledWith('export', expect.objectContaining({
      chapterIds: ['ch_2'],
    }));
  });
});
