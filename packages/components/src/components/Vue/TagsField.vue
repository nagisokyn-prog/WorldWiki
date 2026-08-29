<template>
  <div ref="wrapperRef" class="tags-field-vue" :class="{ 'is-open': isDropdownOpen }">
    <div ref="inputContainerRef" class="tags-input-container interactive-el" @click="focusInput">
      <div v-for="tag in selectedTags" :key="tag" class="tag-pill" :style="{ '--tag-color': getTagColor(tag) }">
        <span class="tag-text">{{ tag }}</span>
        <button class="tag-remove" @click.stop="removeTag(tag)">&times;</button>
      </div>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="tags-input"
        :placeholder="selectedTags.length === 0 ? placeholder : ''"
        @keydown.enter.prevent="addCurrentTag"
        @keydown.backspace="handleBackspace"
        @focus="openDropdown"
        @blur="handleBlur"
      />
    </div>

    <!-- Dropdown with Teleport to ensure it overlays everything -->
    <Teleport to="body">
      <transition name="dropdown-fade">
        <div 
          v-if="isDropdownOpen && (filteredTags.length > 0 || query)" 
          class="tags-dropdown glass-panel"
          :style="dropdownStyle"
        >
          <div 
            v-for="tag in filteredTags" 
            :key="tag.id" 
            class="tag-option interactive-el"
            :class="{ selected: selectedTags.includes(tag.name) }"
            @mousedown.prevent="toggleTag(tag.name)"
          >
            <div class="tag-color-dot" :style="{ '--tag-dot-color': tag.color }"></div>
            <span class="tag-name">{{ tag.name }}</span>
            <i v-if="selectedTags.includes(tag.name)" class="fas fa-check tag-check"></i>
          </div>
          <div v-if="query && !exactMatch" class="tag-option create-option interactive-el" @mousedown.prevent="addCurrentTag">
            <span class="tag-name">{{ t('tags.createTag', { query }) }}</span>
            <span class="tag-hint">Enter</span>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke, processIds } from '../../ts/services/api.service';

const { t } = useI18n();

interface TagItem {
  id?: string;
  name: string;
  color?: string;
  project_id?: string;
  [key: string]: unknown;
}

const apiService = {
  getTags: async (project: string): Promise<TagItem[]> => {
    try {
      const res = await invoke<TagItem[]>('get_tags', { project });
      return res ? processIds(res) : [];
    } catch(e) { console.error(e); return []; }
  },
  saveTag: async (project: string, tagData: Partial<TagItem>) => {
    try {
      const data = { ...tagData, project_id: `projects:${project}` };
      const res = await invoke<TagItem>('save_tag', { data });
      return processIds(res);
    } catch(e) { console.error(e); return null; }
  }
};

const props = defineProps<{
  modelValue: string[] | string | undefined;
  project: string;
  placeholder?: string;
}>();

const emit = defineEmits(['update:modelValue', 'modified']);

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

// Convert modelValue to array safely
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

const loadAllTags = async () => {
  try {
    allTags.value = await apiService.getTags(props.project);
  } catch (e) {
    console.error('[TagsField] Failed to load tags:', e);
  }
};

const getTagColor = (name: string) => {
  const tag = allTags.value.find(t => t.name === name);
  return tag?.color || 'var(--accent)';
};

const focusInput = () => {
  inputRef.value?.focus();
};

const openDropdown = () => {
  isDropdownOpen.value = true;
  nextTick(updateDropdownPosition);
};

watch(isDropdownOpen, (val) => {
  if (val) nextTick(updateDropdownPosition);
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
  nextTick(updateDropdownPosition);
};

const addCurrentTag = async () => {
  const val = query.value.trim();
  if (!val) return;

  if (!selectedTags.value.includes(val)) {
    if (!allTags.value.some(t => t.name.toLowerCase() === val.toLowerCase())) {
      try {
        await apiService.saveTag(props.project, { name: val, color: '#7c3aed' });
        await loadAllTags();
      } catch (e) {
        console.error('[TagsField] Failed to create tag:', e);
      }
    }
    
    const tags = [...selectedTags.value, val];
    updateModel(tags);
  }
  query.value = '';
  nextTick(updateDropdownPosition);
};

const removeTag = (name: string) => {
  const tags = selectedTags.value.filter(t => t !== name);
  updateModel(tags);
  nextTick(updateDropdownPosition);
};

const handleBackspace = () => {
  if (!query.value && selectedTags.value.length > 0) {
    removeTag(selectedTags.value[selectedTags.value.length - 1]);
  }
};

const updateModel = (tags: string[]) => {
  emit('update:modelValue', tags);
  emit('modified');
};

const handleBlur = () => {
  setTimeout(() => {
    isDropdownOpen.value = false;
  }, 200);
};

const handleClickOutside = (e: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    isDropdownOpen.value = false;
  }
};
</script>

<style scoped src="@worldwiki/resources/styles/components/TagsField.css"></style>
