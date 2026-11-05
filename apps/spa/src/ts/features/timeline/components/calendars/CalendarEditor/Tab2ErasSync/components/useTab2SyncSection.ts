import { ref } from 'vue';

export function useTab2SyncSection() {
  const isCollapsed = ref(false);

  return {
    isCollapsed,
  };
}
