<template>
  <div class="tags-field-vue" ref="wrapperRef" :style="{ zIndex: isDropdownOpen ? 10005 : 10 }">
    <div class="tags-input-container interactive-el" ref="inputContainerRef" @click="focusInput">
      <div v-for="tag in selectedTags" :key="tag" class="tag-pill" :style="{ borderColor: getTagColor(tag) }">
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
            <div class="tag-color-dot" :style="{ background: tag.color }"></div>
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
import { invoke, stringifyId, processIds } from '../../js/services/api.service';

const { t } = useI18n();

const apiService = {
  getTags: async (project: string) => {
    try {
      const res = await invoke('get_tags', { project }) as any;
      return res ? processIds(res) as any[] : [];
    } catch(e) { console.error(e); return []; }
  },
  saveTag: async (project: string, tagData: any) => {
    try {
      const data = { ...tagData, project_id: `projects:${project}` };
      const res = await invoke('save_tag', { data });
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
const allTags = ref<any[]>([]);
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
  window.addEventListener('scroll', updateDropdownPosition, true);
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
        await apiService.saveTag(props.project, { name: val, color: '#7c3aed' } as any);
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

<style scoped>
.tags-field-vue {
  position: relative;
  width: 100%;
}

.tags-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-input, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  min-height: 42px;
  cursor: text;
  transition: all 0.2s;
}

.tags-input-container:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
  background: rgba(255, 255, 255, 0.05);
}

.tag-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid var(--accent);
  border-radius: 6px;
  animation: tagIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.tag-text {
  font-size: 13px;
  color: var(--text-main);
  font-weight: 500;
}

.tag-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.tags-input {
  flex: 1;
  min-width: 80px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main);
  font-size: 14px;
}

.tags-dropdown {
  z-index: 99999;
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
  background: var(--bg-panel, #1a1a2e);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.tag-option:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tag-option.selected {
  background: rgba(124, 58, 237, 0.15);
}

.tag-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.tag-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-main);
}

.create-option {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 4px;
}

.tag-hint {
  font-size: 10px;
  color: var(--text-muted);
  padding: 2px 6px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
}

@keyframes tagIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.dropdown-fade-enter-active, .dropdown-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.dropdown-fade-enter-from, .dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
