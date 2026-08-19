import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExportModal } from '../useExportModal';

describe('useExportModal', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    emit = vi.fn();
    props = {
      allChapters: [
        { id: 'ch_1', title: 'Chapter 1' },
        { id: 'ch_2', title: 'Chapter 2' },
      ],
      currentChapterId: 'ch_1',
    };
  });

  it('selects and clears all chapters', () => {
    const modal = useExportModal(props, emit);

    modal.selectAll();
    expect(modal.selectedChapters.value).toEqual(['ch_1', 'ch_2']);

    modal.clearSelection();
    expect(modal.selectedChapters.value).toEqual([]);
  });

  it('exports current chapter', async () => {
    const modal = useExportModal(props, emit);
    modal.selectionMode.value = 'current';

    await modal.exportData();

    expect(emit).toHaveBeenCalledWith('export', expect.objectContaining({
      chapterIds: ['ch_1'],
      format: 'txt',
    }));
  });
});
