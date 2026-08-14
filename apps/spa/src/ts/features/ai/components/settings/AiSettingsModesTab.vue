<template>
  <div class="modes-tab">
    <div class="loading-state" v-if="isLoading">
      Загрузка режимов...
    </div>
    
    <div v-else>
      <div class="mode-selector">
        <label>Режим агента:</label>
        <div style="display: flex; gap: 10px; margin-top: 5px;">
          <select class="input-base" v-model="activeModeSlug" @change="onModeChange" style="flex: 1;">
            <option v-for="mode in modes" :key="mode.slug" :value="mode.slug">
              {{ mode.name }} ({{ mode.slug }})
            </option>
          </select>
          <button class="btn-secondary-outline" @click="createNewMode" title="Создать новый режим">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>

      <div class="mode-editor" v-if="activeMode">
        <div class="form-group">
          <label>ID Режима (slug)</label>
          <input type="text" class="input-base" v-model="activeMode.slug" :disabled="!isNewMode" />
        </div>
        
        <div class="form-group">
          <label>Отображаемое имя (name)</label>
          <input type="text" class="input-base" v-model="activeMode.name" />
        </div>
        
        <div class="form-group">
          <label>Профиль LLM (опционально, переопределяет глобальный)</label>
          <select class="input-base" v-model="activeMode.api_profile_id">
            <option :value="null">-- Использовать профиль по умолчанию --</option>
            <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Роль агента (role_definition)</label>
          <textarea class="input-base" v-model="activeMode.role_definition" rows="4" placeholder="Ты - аналитик..."></textarea>
        </div>

        <div class="form-group">
          <label>Дополнительные инструкции (custom_instructions)</label>
          <textarea class="input-base" v-model="activeMode.custom_instructions" rows="4" placeholder="Дополнительные правила для этого режима..."></textarea>
        </div>

        <div class="form-group">
          <label>Разрешенные инструменты (allowed_tools)</label>
          <div class="tools-list">
            <label class="tool-checkbox" v-for="tool in availableTools" :key="tool">
              <input type="checkbox" :value="tool" v-model="activeMode.allowed_tools" />
              <span>{{ tool }}</span>
            </label>
          </div>
        </div>

        <div class="form-actions" style="margin-top: 20px; text-align: right;">
          <span v-if="saveMessage" class="save-msg">{{ saveMessage }}</span>
          <button class="btn-primary" @click="saveMode">
            Сохранить режим
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useAiProfiles } from '../../composables/useAiProfiles';

const props = defineProps<{
  currentProject: string
}>();

const isLoading = ref(true);
const modes = ref<any[]>([]);
const activeModeSlug = ref<string>('');
const isNewMode = ref(false);
const saveMessage = ref('');

const { profiles, loadProfiles } = useAiProfiles(props.currentProject);

const availableTools = [
  'rag_search', 'search_entities', 'get_entity', 'get_relations',
  'get_chapter', 'get_timeline', 'get_calendar',
  'get_entity_schema', 'update_entity', 'create_entity',
  'create_relation', 'update_chapter', 'add_timeline_event',
  'get_entity_evolution', 'get_relation_history', 'find_contradictions',
  'search_chat_history', 'spawn_subagent'
];

const activeMode = computed(() => {
  return modes.value.find(m => m.slug === activeModeSlug.value);
});

onMounted(async () => {
  await loadProfiles();
  await loadModes();
});

const loadModes = async () => {
  isLoading.value = true;
  try {
    const res: any[] = await invoke('get_ai_modes', { project_id: props.currentProject });
    modes.value = res.length > 0 ? res : getDefaultModes();
    
    if (modes.value.length > 0 && !activeModeSlug.value) {
      activeModeSlug.value = modes.value[0].slug;
    }
  } catch (e) {
    console.error("Failed to load modes", e);
    modes.value = getDefaultModes();
    activeModeSlug.value = modes.value[0].slug;
  }
  isLoading.value = false;
};

const getDefaultModes = () => [
  {
    slug: 'chat',
    name: 'Собеседник',
    project_id: props.currentProject,
    is_global: false,
    role_definition: 'Ты — творческий собеседник для писателя. Помогай генерировать идеи.',
    custom_instructions: '',
    api_profile_id: null,
    allowed_tools: ['rag_search', 'search_entities', 'get_entity', 'get_relations', 'get_chapter', 'get_timeline', 'get_calendar', 'search_chat_history']
  },
  {
    slug: 'edit',
    name: 'Редактор',
    project_id: props.currentProject,
    is_global: false,
    role_definition: 'Ты — редактор вселенной. Можешь читать и изменять данные через инструменты.',
    custom_instructions: '',
    api_profile_id: null,
    allowed_tools: availableTools.slice() // all tools
  },
  {
    slug: 'analyze',
    name: 'Аналитик',
    project_id: props.currentProject,
    is_global: false,
    role_definition: 'Ты — аналитик. Твоя задача находить закономерности и противоречия.',
    custom_instructions: '',
    api_profile_id: null,
    allowed_tools: ['rag_search', 'search_entities', 'get_entity', 'get_relations', 'get_entity_evolution', 'get_relation_history', 'find_contradictions', 'search_chat_history']
  }
];

const onModeChange = () => {
  isNewMode.value = false;
  saveMessage.value = '';
};

const createNewMode = () => {
  const newMode = {
    slug: 'new_mode_' + Date.now().toString().slice(-4),
    name: 'Новый режим',
    project_id: props.currentProject,
    is_global: false,
    role_definition: '',
    custom_instructions: '',
    api_profile_id: null,
    allowed_tools: []
  };
  modes.value.push(newMode);
  activeModeSlug.value = newMode.slug;
  isNewMode.value = true;
};

const saveMode = async () => {
  if (!activeMode.value) return;
  try {
    await invoke('save_ai_mode', { mode: activeMode.value });
    isNewMode.value = false;
    saveMessage.value = 'Сохранено!';
    setTimeout(() => saveMessage.value = '', 3000);
  } catch (e) {
    console.error(e);
    const { appAlert } = await import('@worldwiki/components');
    appAlert('Ошибка при сохранении: ' + e);
  }
};
</script>

<style scoped>
.modes-tab {
  animation: fadeIn 0.2s ease;
}
.mode-selector {
  margin-bottom: 25px;
}
.mode-editor {
  background: var(--bg-surface-alt);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-muted);
}
.tools-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}
.tool-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}
.save-msg {
  color: var(--accent);
  margin-right: 15px;
  font-size: 14px;
}
</style>
