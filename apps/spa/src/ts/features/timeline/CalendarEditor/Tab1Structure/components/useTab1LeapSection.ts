import { ref } from 'vue';

export function useTab1LeapSection() {
  const isCollapsed = ref(false);
  const showSuggestions = ref(false);

  return {
    isCollapsed,
    showSuggestions,
  };
}
