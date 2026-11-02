import { ref, computed, nextTick } from 'vue';
import type { PlanArcGroupProps, PlanArcGroupEmits } from './PlanArcGroup.model';

export function usePlanArcGroup(props: PlanArcGroupProps, emit: PlanArcGroupEmits) {
  const doneCount = computed(() => props.arcGroup.todos.filter(t => t.status === 'done' || t.done).length);

  const isAdding = ref(false);
  const newTodoText = ref('');
  const addInputRef = ref<HTMLInputElement | null>(null);

  function startAdding() {
    isAdding.value = true;
    newTodoText.value = '';
    nextTick(() => addInputRef.value?.focus());
  }

  function cancelAdd() {
    isAdding.value = false;
    newTodoText.value = '';
  }

  function submitAdd() {
    const text = newTodoText.value.trim();
    if (text) {
      emit('add-todo', {
        ownerId: props.chapterId,
        text,
        arcId: props.arcGroup.arcId
      });
    }
    cancelAdd();
  }

  return {
    doneCount,
    isAdding,
    newTodoText,
    addInputRef,
    startAdding,
    cancelAdd,
    submitAdd
  };
}

