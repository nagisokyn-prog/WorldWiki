import { ref } from 'vue';

export function useTab3AgeTimezoneSection(emit: (e: 'add-region', name: string) => void) {
  const showAddRegion = ref(false);
  const newRegionName = ref('');

  function submitNewRegion() {
    const name = newRegionName.value.trim();
    if (name) {
      emit('add-region', name);
      newRegionName.value = '';
      showAddRegion.value = false;
    }
  }

  return {
    showAddRegion,
    newRegionName,
    submitNewRegion,
  };
}
