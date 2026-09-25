import { ref, computed, watch } from 'vue';
import { useStoryArcsStore, type StoryArc } from '@/stores/story_arcs.store';
import type { ChapterArcTagsProps, ChapterArcTagsEmits, ChapterBoundArc } from './ChapterArcTags.model';

export function useChapterArcTags(
  props: ChapterArcTagsProps,
  emit?: ChapterArcTagsEmits
) {
  const store = useStoryArcsStore();
  const isPickerOpen = ref(false);
  const newArcTitle = ref('');
  const isCreating = ref(false);

  const cleanChapterId = computed(() => {
    if (!props.chapterId) return '';
    return props.chapterId.includes(':') ? props.chapterId : `chapters:${props.chapterId}`;
  });

  const loadData = async () => {
    if (!props.project) return;
    await store.loadArcs(props.project);
    if (store.arcs.length > 0) {
      await Promise.all(
        store.arcs.map(arc => arc.id ? store.loadBindings(arc.id) : Promise.resolve())
      );
    }
  };

  watch(() => [props.project, props.chapterId], loadData, { immediate: true });

  const boundArcs = computed<ChapterBoundArc[]>(() => {
    if (!cleanChapterId.value) return [];
    const result: ChapterBoundArc[] = [];

    for (const arc of store.arcs) {
      if (!arc.id) continue;
      const relations = store.arcChapters.get(arc.id) || [];
      const isBound = relations.some(r => {
        const outCandidate = r.chapter_id || r.out;
        if (!outCandidate) return false;
        const outClean = outCandidate.includes(':') ? outCandidate : `chapters:${outCandidate}`;
        return outClean === cleanChapterId.value;
      });

      if (isBound) {
        result.push({
          arcId: arc.id,
          title: arc.title,
          color: arc.color,
          arcType: arc.arc_type
        });
      }
    }

    return result;
  });

  const availableArcs = computed<StoryArc[]>(() => {
    const boundIds = new Set(boundArcs.value.map(b => b.arcId));
    return store.arcs.filter(a => a.id && !boundIds.has(a.id));
  });

  const attachArc = async (arcId: string) => {
    if (!cleanChapterId.value || !props.project) return;
    await store.bindChapter({
      in: arcId,
      out: cleanChapterId.value,
      project_id: props.project
    });
    isPickerOpen.value = false;
    emit?.('change');
  };

  const detachArc = async (arcId: string) => {
    if (!cleanChapterId.value) return;
    await store.unbindChapter(arcId, cleanChapterId.value);
    emit?.('change');
  };

  const createAndAttachArc = async () => {
    const title = newArcTitle.value.trim();
    if (!title || !props.project) return;
    isCreating.value = true;
    try {
      const created = await store.saveArc({
        title,
        arc_type: 'event',
        status: 'in_progress',
        project_id: props.project
      });


      if (created?.id) {
        await attachArc(created.id);
        newArcTitle.value = '';
      }
    } finally {
      isCreating.value = false;
    }
  };

  return {
    isPickerOpen,
    newArcTitle,
    isCreating,
    boundArcs,
    availableArcs,
    attachArc,
    detachArc,
    createAndAttachArc,
    loadData
  };
}
