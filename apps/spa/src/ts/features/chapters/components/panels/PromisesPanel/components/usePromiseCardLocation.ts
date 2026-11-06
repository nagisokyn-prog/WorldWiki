import { ref, computed, watch, type Ref } from 'vue';
import type { PromiseCardMetaProps, PromiseCardMetaEmits, ProjectEntityOption } from './PromiseCardMeta/PromiseCardMeta.model';

export function usePromiseCardLocation(
  props: PromiseCardMetaProps,
  projectLocations: Ref<ProjectEntityOption[]>,
  emit: PromiseCardMetaEmits
) {
  const locationDraft = ref(props.item.location_id || '');
  const isLocationDropdownOpen = ref(false);

  watch(() => props.item.location_id, (val) => {
    locationDraft.value = val || '';
  });

  const filteredLocations = computed(() => {
    const q = locationDraft.value.trim().toLowerCase();
    if (!q) return projectLocations.value;
    return projectLocations.value.filter(l => l.name.toLowerCase().includes(q));
  });

  const getLocationDisplayName = (locIdOrName: string): string => {
    if (!locIdOrName) return '';
    const clean = String(locIdOrName).trim();
    const found = projectLocations.value.find(l =>
      l.id === clean ||
      l.id.replace(/^(locations|entities):/, '') === clean ||
      l.name.toLowerCase() === clean.toLowerCase()
    );
    return found?.name || clean;
  };

  const isEntityLocation = computed(() => {
    if (!props.item.location_id) return false;
    const clean = String(props.item.location_id).trim().toLowerCase();
    return projectLocations.value.some(l =>
      l.id.toLowerCase() === clean ||
      l.id.toLowerCase().replace(/^(locations|entities):/, '') === clean ||
      l.name.toLowerCase() === clean
    );
  });

  const selectLocation = (locName: string) => {
    const clean = locName.trim();
    const found = projectLocations.value.find(l => l.name.toLowerCase() === clean.toLowerCase());
    const finalVal = found ? found.name : clean;
    const updated = {
      ...props.item,
      location_id: finalVal || null
    };
    emit('update:item', updated);
    emit('change');
    locationDraft.value = finalVal;
    isLocationDropdownOpen.value = false;
  };

  const onLocationBlur = () => {
    setTimeout(() => {
      isLocationDropdownOpen.value = false;
      const currentVal = (props.item.location_id || '').trim();
      const draftVal = locationDraft.value.trim();
      if (draftVal !== currentVal) {
        selectLocation(draftVal);
      }
    }, 200);
  };

  const clearLocation = () => {
    const updated = {
      ...props.item,
      location_id: null
    };
    emit('update:item', updated);
    emit('change');
    locationDraft.value = '';
    isLocationDropdownOpen.value = false;
  };

  const saveLocation = () => {
    const val = locationDraft.value.trim();
    if (val === (props.item.location_id || '')) return;
    const updated = {
      ...props.item,
      location_id: val || null
    };
    emit('update:item', updated);
    emit('change');
  };

  return {
    locationDraft,
    isLocationDropdownOpen,
    filteredLocations,
    getLocationDisplayName,
    isEntityLocation,
    selectLocation,
    onLocationBlur,
    clearLocation,
    saveLocation
  };
}

