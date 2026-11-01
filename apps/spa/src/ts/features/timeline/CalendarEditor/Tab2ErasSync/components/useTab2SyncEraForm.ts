import { computed } from 'vue';
import type { Tab2SyncEraFormProps } from './Tab2SyncEraForm.model';

export function useTab2SyncEraForm(props: Tab2SyncEraFormProps) {
  const eraOptions = computed(() => [
    { value: '-1', label: '🌍 От начала Календаря Мира (Год 1)' },
    ...props.masterEras.map((era, idx) => ({
      value: String(idx),
      label: `🏛️ ${era.название} (с ${era.год_начала} г.)`,
    })),
  ]);

  return {
    eraOptions,
  };
}
