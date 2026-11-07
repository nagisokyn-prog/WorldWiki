import { describe, it, expect, vi } from 'vitest';
import { usePromiseCard } from './usePromiseCard';
import type { RichPlotPromise } from '../../usePromisesPanel';

describe('usePromiseCard', () => {
  const mockItem: RichPlotPromise = {
    id: 'p1',
    project_id: 'proj1',
    chapter_id: 'ch1',
    kind: 'scene',
    quote: 'Тестовая цитата',
    paragraph_index: 3,
    block_id: 'b1',
    note: null,
    status: 'planted',
    progressions: [],
    resolution: null,
    resolved_in_volume: null,
    resolved_in_chapter: null,
    participant_ids: null,
    location_id: null,
    timeline_event_id: null,
    arc_id: null,
    arc_phase: null
  };

  const props = {
    project: 'proj1',
    item: mockItem,
    kindInfo: { label: 'Сцена', icon: '🎬' },
    editingNoteId: null,
    noteDraft: '',
    getChapterTitle: () => 'Глава 1',
    isCurrentChapterPromise: () => true
  };

  it('toggles collapsed state', () => {
    const emit = vi.fn();
    const { isCardCollapsed, toggleCollapsed } = usePromiseCard(props, emit);

    expect(isCardCollapsed.value).toBe(false);
    toggleCollapsed();
    expect(isCardCollapsed.value).toBe(true);
    toggleCollapsed();
    expect(isCardCollapsed.value).toBe(false);
  });

  it('emits locate event with correct payload', () => {
    const emit = vi.fn();
    const { handleLocate } = usePromiseCard(props, emit);

    handleLocate();
    expect(emit).toHaveBeenCalledWith('locate', {
      chapter_id: 'ch1',
      paragraph_index: 3,
      quote: 'Тестовая цитата',
      block_id: 'b1',
      block_ids: ['b1']
    });
  });

  it('emits remove event', () => {
    const emit = vi.fn();
    const { handleRemove } = usePromiseCard(props, emit);

    handleRemove();
    expect(emit).toHaveBeenCalledWith('remove', mockItem);
  });
});
