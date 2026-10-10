import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke, processIds } from '../../ts/services/api.service';

export interface TagItem {
  id?: string;
  name: string;
  color?: string;
  project_id?: string;
  [key: string]: unknown;
}

export interface TagsFieldProps {
  modelValue: string[] | string | undefined;
  project: string;
  placeholder?: string;
}

export interface TagsFieldEmits {
  (e: 'update:modelValue', val: string[]): void;
  (e: 'modified'): void;
}

function projectRecordId(p: string): string {
  const clean = (p || 'default').replace(/^projects:/, '').replace(/[`'"]/g, '');
  return `projects:${clean}`;
}

export function useTagsField(
  props: TagsFieldProps,
  emit: TagsFieldEmits
) {
  const { t } = useI18n();

  const apiService = {
    getTags: async (project: string): Promise<TagItem[]> => {
      try {
        const res = await invoke<TagItem[]>('get_tags', { project });
        return res ? processIds(res) : [];
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    saveTag: async (project: string, tagData: Partial<TagItem>) => {
      try {
        const data = { ...tagData, project_id: projectRecordId(project) };
        const res = await invoke<TagItem>('save_tag', { data });
        return processIds(res);
      } catch (e) {
        console.error(e);
        return null;
      }
    }
  };

  const wrapperRef = ref<HTMLElement | null>(null);
  const inputContainerRef = ref<HTMLElement | null>(null);
  const inputRef = ref<HTMLInputElement | null>(null);
  const query = ref('');
  const isDropdownOpen = ref(false);
  const allTags = ref<TagItem[]>([]);
  const dropdownStyle = ref({
    position: 'fixed' as const,
    top: '0px',
    left: '0px',
    width: '0px',
    zIndex: 99999
  });

  const selectedTags = computed(() => {
    if (!props.modelValue) return [];
    if (Array.isArray(props.modelValue)) return props.modelValue;
    try {
      const parsed = JSON.parse(props.modelValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const filteredTags = computed(() => {
    const q = query.value.toLowerCase().trim();
    if (!q) return allTags.value.slice(0, 10);
    return allTags.value.filter(t => t.name.toLowerCase().includes(q));
  });

  const exactMatch = computed(() => {
    const q = query.value.toLowerCase().trim();
    return allTags.value.some(t => t.name.toLowerCase() === q);
  });

  const updateDropdownPosition = () => {
    if (!isDropdownOpen.value || !inputContainerRef.value) return;
    
    const rect = inputContainerRef.value.getBoundingClientRect();
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: 99999
    };
  };

  const loadAllTags = async () => {
    try {
      allTags.value = await apiService.getTags(props.project);
    } catch (e) {
      console.error('[TagsField] Failed to load tags:', e);
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
      isDropdownOpen.value = false;
    }
  };

  onMounted(async () => {
    await loadAllTags();
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, { passive: true, capture: true });
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', updateDropdownPosition);
    window.removeEventListener('scroll', updateDropdownPosition, true);
  });

  const getTagColor = (name: string) => {
    const tag = allTags.value.find(t => t.name === name);
    return tag?.color || 'var(--accent)';
  };

  const focusInput = () => {
    inputRef.value?.focus();
  };

  const openDropdown = () => {
    isDropdownOpen.value = true;
    void nextTick(updateDropdownPosition);
  };

  watch(isDropdownOpen, (val) => {
    if (val) void nextTick(updateDropdownPosition);
  });

  const updateModel = (tags: string[]) => {
    emit('update:modelValue', tags);
    emit('modified');
  };

  const toggleTag = (name: string) => {
    const tags = [...selectedTags.value];
    const idx = tags.indexOf(name);
    if (idx > -1) {
      tags.splice(idx, 1);
    } else {
      tags.push(name);
    }
    updateModel(tags);
    query.value = '';
    void nextTick(updateDropdownPosition);
  };

  const addCurrentTag = async () => {
    const val = query.value.trim();
    if (!val) return;

    if (!selectedTags.value.includes(val)) {
      if (!allTags.value.some(t => t.name.toLowerCase() === val.toLowerCase())) {
        try {
          await apiService.saveTag(props.project, { name: val, color: 'var(--accent)' });
          await loadAllTags();
        } catch (e) {
          console.error('[TagsField] Failed to create tag:', e);
        }
      }
      
      const tags = [...selectedTags.value, val];
      updateModel(tags);
    }
    query.value = '';
    void nextTick(updateDropdownPosition);
  };

  const removeTag = (name: string) => {
    const tags = selectedTags.value.filter(t => t !== name);
    updateModel(tags);
    void nextTick(updateDropdownPosition);
  };

  const handleBackspace = () => {
    if (!query.value && selectedTags.value.length > 0) {
      removeTag(selectedTags.value[selectedTags.value.length - 1]);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      isDropdownOpen.value = false;
    }, 200);
  };

  return {
    t,
    wrapperRef,
    inputContainerRef,
    inputRef,
    query,
    isDropdownOpen,
    dropdownStyle,
    selectedTags,
    filteredTags,
    exactMatch,
    getTagColor,
    focusInput,
    openDropdown,
    toggleTag,
    addCurrentTag,
    removeTag,
    handleBackspace,
    handleBlur
  };
}
