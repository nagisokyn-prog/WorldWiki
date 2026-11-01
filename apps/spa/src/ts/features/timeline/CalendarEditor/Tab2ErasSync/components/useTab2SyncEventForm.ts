import { computed } from 'vue';
import type { Tab2SyncEventFormProps } from './Tab2SyncEventForm.model';

export function useTab2SyncEventForm(props: Tab2SyncEventFormProps) {
  const eventOptions = computed(() =>
    props.anchorEvents.map((ev) => ({
      value: ev.id || ev.name,
      label: `${ev.name} (Год ${ev.year})`,
    }))
  );

  return {
    eventOptions,
  };
}
