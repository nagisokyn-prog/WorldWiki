import { ref, computed } from 'vue';
import { useStoryArcsStore, type StoryArc } from '@/stores/story_arcs.store';
import type {
  PromiseCardArcTagsProps,
  PromiseCardArcTagsEmits,
  SceneArcItem,
  BoundArcWithMeta,
  ArcPhase
} from './PromiseCardArcTags.model';

export function usePromiseCardArcTags(
  props: PromiseCardArcTagsProps,
  emit?: PromiseCardArcTagsEmits
) {
  const arcsStore = useStoryArcsStore();
  const isPickerOpen = ref(false);
  const newArcTitle = ref('');
  const isCreating = ref(false);

  const currentRawArcs = computed<SceneArcItem[]>(() => {
    if (Array.isArray(props.arcs) && props.arcs.length > 0) {
      return props.arcs;
    }
    if (props.legacyArcId) {
      return [{
        arc_id: props.legacyArcId,
        arc_phase: props.legacyArcPhase || 'setup'
      }];
    }
    return [];
  });

  const allArcsList = computed<StoryArc[]>(() => {
    if (Array.isArray(props.availableArcs) && props.availableArcs.length > 0) {
      return props.availableArcs;
    }
    return arcsStore.arcs;
  });

  const boundArcs = computed<BoundArcWithMeta[]>(() => {
    const list: BoundArcWithMeta[] = [];
    const arcsMap = new Map<string, StoryArc>();

    for (const a of allArcsList.value) {
      if (a.id) arcsMap.set(a.id, a);
      const clean = (a.id || '').replace(/^story_arcs:/, '');
      if (clean) arcsMap.set(clean, a);
    }

    for (const item of currentRawArcs.value) {
      if (!item.arc_id) continue;
      const arcObj = arcsMap.get(item.arc_id) || arcsMap.get(item.arc_id.replace(/^story_arcs:/, ''));
      const title = arcObj?.title || item.arc_id.replace(/^story_arcs:/, 'Арка ');
      list.push({
        arcId: item.arc_id,
        title,
        color: arcObj?.color,
        arcType: arcObj?.arc_type,
        phase: (item.arc_phase as ArcPhase) || 'setup'
      });
    }

    return list;
  });

  const selectableArcs = computed<StoryArc[]>(() => {
    const boundIds = new Set(
      currentRawArcs.value.map(b => (b.arc_id || '').replace(/^story_arcs:/, ''))
    );
    return allArcsList.value.filter(a => {
      if (!a.id) return false;
      const clean = a.id.replace(/^story_arcs:/, '');
      return !boundIds.has(clean) && !boundIds.has(a.id);
    });
  });

  const emitUpdate = (nextArcs: SceneArcItem[]) => {
    emit?.('update:arcs', nextArcs);
    emit?.('change');
  };

  const attachArc = (arcId: string, phase: ArcPhase = 'setup') => {
    const cleanId = arcId;
    const existing = currentRawArcs.value.filter(a => a.arc_id !== cleanId);
    const updated = [...existing, { arc_id: cleanId, arc_phase: phase }];
    isPickerOpen.value = false;
    emitUpdate(updated);
  };

  const detachArc = (arcId: string) => {
    const cleanTarget = arcId.replace(/^story_arcs:/, '');
    const updated = currentRawArcs.value.filter(
      a => a.arc_id !== arcId && a.arc_id.replace(/^story_arcs:/, '') !== cleanTarget
    );
    emitUpdate(updated);
  };

  const updateArcPhase = (arcId: string, newPhase: string) => {
    const cleanTarget = arcId.replace(/^story_arcs:/, '');
    const updated = currentRawArcs.value.map(item => {
      if (item.arc_id === arcId || item.arc_id.replace(/^story_arcs:/, '') === cleanTarget) {
        return { ...item, arc_phase: newPhase as ArcPhase };
      }
      return item;
    });
    emitUpdate(updated);
  };

  const createAndAttachArc = async () => {
    const title = newArcTitle.value.trim();
    if (!title || !props.project) return;
    isCreating.value = true;
    try {
      const created = await arcsStore.saveArc({
        title,
        arc_type: 'event',
        status: 'in_progress',
        project_id: props.project
      });

      if (created?.id) {
        attachArc(created.id, 'setup');
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
    selectableArcs,
    attachArc,
    detachArc,
    updateArcPhase,
    createAndAttachArc
  };
}
