import { ref, computed, nextTick } from 'vue';
import type { TapestryChapterCardProps, TapestryChapterCardEmits } from './TapestryChapterCard.model';

export function useTapestryChapterCard(props: TapestryChapterCardProps, emit: TapestryChapterCardEmits) {
  const isArcPickerOpen = ref(false);

  const availableArcs = computed(() => {
    const boundSet = new Set(props.chapter.arcGroups.map(g => g.arcId.replace(/^story_arcs:/, '')));
    return props.allProjectArcs.filter(a => a.id && !boundSet.has(a.id.replace(/^story_arcs:/, '')));
  });

  function selectArcToAttach(arcId: string | null) {
    if (arcId) {
      emit('attach-arc', { chapterId: props.chapter.chapterId, arcId });
    }
    isArcPickerOpen.value = false;
  }

  const isAddingStandalone = ref(false);
  const newStandaloneText = ref('');
  const standaloneInputRef = ref<HTMLInputElement | null>(null);

  function startAddingStandalone() {
    isAddingStandalone.value = true;
    newStandaloneText.value = '';
    nextTick(() => standaloneInputRef.value?.focus());
  }

  function cancelStandalone() {
    isAddingStandalone.value = false;
    newStandaloneText.value = '';
  }

  function submitStandalone() {
    const text = newStandaloneText.value.trim();
    if (text) {
      emit('add-todo', {
        ownerId: props.chapter.chapterId,
        text,
        arcId: null
      });
    }
    cancelStandalone();
  }

  function onToggleCollapse() {
    emit('toggle-collapse', props.chapter.chapterId);
  }

  return {
    isArcPickerOpen,
    availableArcs,
    selectArcToAttach,
    isAddingStandalone,
    newStandaloneText,
    standaloneInputRef,
    startAddingStandalone,
    cancelStandalone,
    submitStandalone,
    onToggleCollapse
  };
}
