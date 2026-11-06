import { ref } from 'vue';
import type { AnchorEventDto } from '../../Tab2ErasSync.model';
import type { Tab2AnchorEventsSectionProps, Tab2AnchorEventsSectionEmits } from './Tab2AnchorEventsSection.model';

export function useTab2AnchorEventsSection(
  props: Tab2AnchorEventsSectionProps,
  emit: Tab2AnchorEventsSectionEmits
) {
  const showAddRow = ref(false);
  const newEventName = ref('');
  const newEventYear = ref<number | null>(null);
  const newEventMonth = ref<number | null>(1);
  const newEventDay = ref<number | null>(1);
  const newEventDesc = ref('');

  function onFieldChange(idx: number, field: keyof AnchorEventDto, value: unknown) {
    const current = props.anchorEvents[idx];
    if (!current) return;
    const updated: AnchorEventDto = { ...current, [field]: value };
    emit('update-anchor-event', idx, updated);
  }

  function submitNewEvent() {
    const trimmed = newEventName.value.trim();
    if (!trimmed || newEventYear.value === null) return;
    emit('add-anchor-event', {
      id: `ev_${Date.now()}`,
      name: trimmed,
      year: newEventYear.value,
      month: (newEventMonth.value ?? 1) - 1,
      day: newEventDay.value ?? 1,
      description: newEventDesc.value.trim() || undefined,
    });
    newEventName.value = '';
    newEventYear.value = null;
    newEventMonth.value = 1;
    newEventDay.value = 1;
    newEventDesc.value = '';
    showAddRow.value = false;
  }

  function cancelAddEvent() {
    showAddRow.value = false;
  }

  function openAddRow() {
    showAddRow.value = true;
  }

  return {
    showAddRow,
    newEventName,
    newEventYear,
    newEventMonth,
    newEventDay,
    newEventDesc,
    onFieldChange,
    submitNewEvent,
    cancelAddEvent,
    openAddRow,
  };
}
