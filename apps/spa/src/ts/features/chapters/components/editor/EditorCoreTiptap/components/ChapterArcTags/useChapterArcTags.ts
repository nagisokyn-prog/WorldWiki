import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useStoryArcsStore, type StoryArc } from '@/stores/story_arcs.store';
import { plotApi } from '@/services/api/plot.api';
import type { RichPlotPromise } from '@/types/narrative';
import type { ChapterArcTagsProps, ChapterArcTagsEmits, ChapterBoundArc } from './ChapterArcTags.model';

export function useChapterArcTags(
  props: ChapterArcTagsProps,
  emit?: ChapterArcTagsEmits
) {
  const store = useStoryArcsStore();
  const isPickerOpen = ref(false);
  const newArcTitle = ref('');
  const isCreating = ref(false);
  const sceneArcIdsInChapter = ref<Set<string>>(new Set());

  const cleanChapterId = computed(() => {
    if (!props.chapterId) return '';
    return props.chapterId.includes(':') ? props.chapterId : `chapters:${props.chapterId}`;
  });

  const stripPrefix = (id?: string | null) =>
    String(id || '').replace(/^(chapters|story_arcs):/i, '').replace(/[`⟨⟩"']/g, '').trim();

  const loadSceneArcs = async () => {
    if (!props.project || !cleanChapterId.value) {
      sceneArcIdsInChapter.value = new Set();
      return;
    }
    try {
      const raw = await plotApi.getPlotPromises(props.project);
      const list = Array.isArray(raw) ? (raw as unknown as RichPlotPromise[]) : [];
      const targetChap = stripPrefix(cleanChapterId.value);
      const found = new Set<string>();
      for (const p of list) {
        const pChap = stripPrefix(p.chapter_id || p.milestones?.[0]?.chapter_id);
        if (!pChap || pChap !== targetChap) continue;
        if (Array.isArray(p.arcs)) {
          for (const a of p.arcs) {
            if (a?.arc_id) found.add(stripPrefix(String(a.arc_id)));
          }
        }
        if (p.arc_id) found.add(stripPrefix(String(p.arc_id)));
      }
      sceneArcIdsInChapter.value = found;
    } catch (err) {
      console.warn('[useChapterArcTags] Failed to load scene arcs:', err);
    }
  };

  const loadData = async () => {
    if (!props.project) return;
    await store.loadArcs(props.project);
    await Promise.all([
      ...store.arcs.map(arc => arc.id ? store.loadBindings(arc.id) : Promise.resolve()),
      loadSceneArcs()
    ]);
  };

  const onArcsChanged = () => { void loadSceneArcs(); };
  onMounted(() => { document.addEventListener('ww:chapter-arcs-changed', onArcsChanged); });
  onUnmounted(() => { document.removeEventListener('ww:chapter-arcs-changed', onArcsChanged); });

  watch(() => [props.project, props.chapterId], loadData, { immediate: true });

  const boundArcs = computed<ChapterBoundArc[]>(() => {
    if (!cleanChapterId.value) return [];
    const result: ChapterBoundArc[] = [];

    const targetChap = stripPrefix(cleanChapterId.value);
    for (const arc of store.arcs) {
      if (!arc.id) continue;
      const relations = store.arcChapters.get(arc.id) || [];
      const isDirect = relations.some(r => {
        const outCandidate = r.chapter_id || r.out;
        if (!outCandidate) return false;
        return stripPrefix(outCandidate) === targetChap;
      });
      const isFromScene = sceneArcIdsInChapter.value.has(stripPrefix(arc.id));

      if (isDirect || isFromScene) {
        result.push({
          arcId: arc.id,
          title: arc.title,
          color: arc.color,
          arcType: arc.arc_type,
          fromScene: !isDirect && isFromScene
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
