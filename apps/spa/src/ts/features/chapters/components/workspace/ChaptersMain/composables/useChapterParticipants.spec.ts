import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useChapterParticipants } from './useChapterParticipants';
import { useTimelineStore } from '@/stores/timeline.store';
import type { ChapterWithHierarchy } from '@/stores/chapter.store';

describe('useChapterParticipants', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('syncs auto participants from chapter content while preserving manual participants', async () => {
    const timelineStore = useTimelineStore();
    vi.spyOn(timelineStore, 'parseParticipants').mockReturnValue([
      { id: 'char:1', type: 'character', name: 'Герой' },
      { id: 'char:2', type: 'character', name: 'Маг' },
    ]);

    const ch = ref<ChapterWithHierarchy | null>({
      id: 'chapters:1',
      title: 'Ch1',
      content: '((Герой)) и ((Маг))',
      participants: [{ id: 'char:1', type: 'character', name: 'Герой', autoParsed: false }] as unknown as string[],
    } as ChapterWithHierarchy);
    const onUnsaved = vi.fn();

    const { syncAutoParticipants, handleAddParticipant } = useChapterParticipants(ch, onUnsaved);
    syncAutoParticipants();

    const parts = ch.value?.participants as unknown as Array<{ id: string; autoParsed?: boolean }>;
    expect(parts).toHaveLength(2);
    expect(parts[0].autoParsed).toBe(false);
    expect(parts[1].id).toBe('char:2');

    // handleAddParticipant adds new and skips duplicate
    handleAddParticipant({ type: 'character', id: 'char:3', name: 'Злодей' });
    expect(onUnsaved).toHaveBeenCalledTimes(1);
    handleAddParticipant({ type: 'character', id: 'char:3', name: 'Злодей' });
    expect(onUnsaved).toHaveBeenCalledTimes(1);

    // Null chapter guard
    ch.value = null;
    syncAutoParticipants();
    handleAddParticipant({ type: 'character', id: 'char:4' });
  });
});
