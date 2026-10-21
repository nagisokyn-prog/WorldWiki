import { ref } from 'vue';
import type { AnchorEventDto } from '../Tab2ErasSync.model';

export function useTab2AnchorEventsSection(emit: (e: 'add-anchor-event', event: AnchorEventDto) => void) {
  const showAddRow = ref(false);
  const newEventName = ref('');
  const newEventYear = ref<number>(1);

  function submitNewEvent() {
    const name = newEventName.value.trim();
    if (!name) return;
    emit('add-anchor-event', {
      name,
      year: newEventYear.value || 1,
      month: 0,
      day: 1,
    });
    newEventName.value = '';
    newEventYear.value = 1;
    showAddRow.value = false;
  }

  return {
    showAddRow,
    newEventName,
    newEventYear,
    submitNewEvent,
  };
}
