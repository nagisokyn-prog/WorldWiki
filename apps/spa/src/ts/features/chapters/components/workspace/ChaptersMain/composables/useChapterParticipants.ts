import { watch, type Ref } from 'vue';
import { useTimelineStore } from '@/stores/timeline.store';
import type { ChapterWithHierarchy } from '@/stores/chapter.store';

export function useChapterParticipants(
  currentChapter: Ref<ChapterWithHierarchy | null>,
  onUnsaved: () => void
) {
  const syncAutoParticipants = () => {
    if (!currentChapter.value) return;
    const timelineStore = useTimelineStore();
    const autoParts = timelineStore.parseParticipants(currentChapter.value.content || '');
    const currentList = (currentChapter.value.participants || []) as unknown as Array<{
      id?: string;
      type?: string;
      name?: string;
      autoParsed?: boolean;
      [key: string]: unknown;
    }>;

    const manualParts = currentList.filter(
      (p) => typeof p === 'object' && p && !p.autoParsed
    );
    const newAutoParts = autoParts.map((p) => ({ ...p, autoParsed: true }));

    const combined = [...manualParts];
    newAutoParts.forEach((ap) => {
      if (
        !combined.some(
          (p) =>
            (p.id && p.id === ap.id && p.type === ap.type) ||
            (p.name && p.name === ap.name)
        )
      ) {
        combined.push(ap);
      }
    });

    const prevIds = (
      (currentChapter.value.participants || []) as unknown as Array<
        { id?: string; type?: string } | string
      >
    )
      .map((p) => (typeof p === 'string' ? p : p.id))
      .filter(Boolean)
      .join('|');
    const newIds = combined.map((p) => p.id).filter(Boolean).join('|');

    if (prevIds !== newIds) {
      currentChapter.value.participants = combined as unknown as string[];
    }
  };

  const handleAddParticipant = (p: { type: string; id: string; name?: string }) => {
    if (!currentChapter.value) return;
    const currentList = (currentChapter.value.participants || []) as unknown as Array<{
      id?: string;
      type?: string;
      name?: string;
      autoParsed?: boolean;
      [key: string]: unknown;
    }>;
    const rawId = p.id.includes(':') ? p.id.split(':').slice(1).join(':') : p.id;
    if (
      !currentList.some(
        (item) => item.id === p.id || (rawId && item.id && item.id.includes(rawId))
      )
    ) {
      currentChapter.value.participants = [
        ...currentList,
        { type: p.type, id: p.id, name: p.name || p.id, autoParsed: true },
      ] as unknown as string[];
      onUnsaved();
    }
  };

  watch(
    () => currentChapter.value?.content,
    () => {
      syncAutoParticipants();
    },
    { immediate: true }
  );

  return {
    syncAutoParticipants,
    handleAddParticipant,
  };
}
