import { ref, onMounted } from 'vue';
import * as api from '@/services/api.client';

export interface EntityTypeOption {
  value: string;
  label: string;
  icon?: string;
}

const BUILTIN_SCHEMAS: EntityTypeOption[] = [
  { value: 'character', label: 'Персонаж', icon: '👤' },
  { value: 'location', label: 'Локация', icon: '📍' },
  { value: 'state', label: 'Государство', icon: '🏛️' },
  { value: 'organization', label: 'Организация', icon: '🏢' },
  { value: 'item', label: 'Предмет', icon: '🗡️' },
  { value: 'event', label: 'Событие', icon: '📅' },
  { value: 'fraction', label: 'Фракция', icon: '🚩' },
  { value: 'calendar', label: 'Календарь', icon: '📆' },
  { value: 'planet', label: 'Планета', icon: '🪐' },
  { value: 'timezone', label: 'Часовой пояс', icon: '🕒' },
];

export function useAvailableEntityTypes(project?: string) {
  const availableTypes = ref<EntityTypeOption[]>([...BUILTIN_SCHEMAS]);
  const isLoading = ref(false);

  const loadTypes = async () => {
    isLoading.value = true;
    try {
      const urlProject = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('project')
        : null;
      const proj = project || urlProject || 'default';
      const schemas = await api.getEntitySchemas(proj);
      const existing = new Set(availableTypes.value.map((t) => t.value));

      if (Array.isArray(schemas)) {
        for (const s of schemas) {
          if (s.type_key && !existing.has(s.type_key)) {
            existing.add(s.type_key);
            availableTypes.value.push({
              value: s.type_key,
              label: s.type_name || s.type_key,
              icon: (s as { icon?: string }).icon || '📄',
            });
          }
        }
      }
    } catch (e) {
      console.warn('[useAvailableEntityTypes] Failed to load custom schemas:', e);
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    void loadTypes();
  });

  return {
    availableTypes,
    isLoading,
    loadTypes,
  };
}

