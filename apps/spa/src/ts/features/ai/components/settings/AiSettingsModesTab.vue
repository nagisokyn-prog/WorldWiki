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
          <label>ID Режима</label>
          <input type="text" class="input-base" v-model="activeMode.slug" :disabled="!isNewMode" />
        </div>
        
        <div class="form-group">
          <label>Отображаемое имя</label>
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
          <label>Роль агента</label>
          <textarea class="input-base" v-model="activeMode.role_definition" rows="4" placeholder="Ты - аналитик..."></textarea>
        </div>

        <div class="form-group">
          <label>Дополнительные инструкции</label>
          <textarea class="input-base" v-model="activeMode.custom_instructions" rows="4" placeholder="Дополнительные правила для этого режима..."></textarea>
        </div>

        <div class="form-group">
          <label>Разрешенные инструменты</label>
          <div class="tools-list">
            <label class="tool-checkbox" v-for="tool in availableTools" :key="tool" :title="toolDescriptions[tool]?.desc || ''">
              <input type="checkbox" :value="tool" v-model="activeMode.allowed_tools" />
              <span>{{ toolDescriptions[tool]?.name || tool }}</span>
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
  'get_chapters_list', 'get_chapter', 'get_timeline', 'get_calendar',
  'get_entity_schema', 'update_entity', 'create_entity',
  'create_relation', 'update_chapter', 'add_timeline_event',
  'get_entity_evolution', 'get_relation_history', 'find_contradictions',
  'search_chat_history', 'spawn_subagent'
];

const toolDescriptions: Record<string, { name: string, desc: string }> = {
  'rag_search': { name: 'Семантический поиск', desc: 'Поиск информации по тексту во всей базе данных (RAG)' },
  'search_entities': { name: 'Поиск сущностей', desc: 'Поиск конкретных персонажей, локаций, предметов по названию' },
  'get_entity': { name: 'Чтение сущности', desc: 'Получение всех деталей и свойств выбранной сущности' },
  'get_relations': { name: 'Связи сущности', desc: 'Получение всех связей этой сущности с другими объектами' },
  'get_chapters_list': { name: 'Оглавление', desc: 'Получение списка всех глав с их ID для последующего чтения' },
  'get_chapter': { name: 'Чтение главы', desc: 'Чтение полного текста конкретной главы книги по её ID' },
  'get_timeline': { name: 'Таймлайн', desc: 'Просмотр хронологии событий' },
  'get_calendar': { name: 'Календарь', desc: 'Чтение календарных данных и конвертация времени' },
  'get_entity_schema': { name: 'Схема сущностей', desc: 'Получение схемы полей для определённого типа данных' },
  'update_entity': { name: 'Редактировать сущность', desc: 'Изменение данных существующей сущности' },
  'create_entity': { name: 'Создать сущность', desc: 'Создание нового персонажа, предмета, локации и т.д.' },
  'create_relation': { name: 'Создать связь', desc: 'Создание логической связи между двумя сущностями' },
  'update_chapter': { name: 'Редактировать главу', desc: 'Изменение текста главы' },
  'add_timeline_event': { name: 'Добавить событие', desc: 'Добавление нового события в таймлайн' },
  'get_entity_evolution': { name: 'Эволюция сущности', desc: 'Отслеживание изменений сущности во времени' },
  'get_relation_history': { name: 'История связей', desc: 'Отслеживание развития отношений между сущностями' },
  'find_contradictions': { name: 'Поиск противоречий', desc: 'Автоматический анализ сюжета на наличие логических дыр' },
  'search_chat_history': { name: 'Поиск по чатам', desc: 'Поиск информации в старых диалогах с ИИ' },
  'spawn_subagent': { name: 'Создать субагента', desc: 'Запуск автономного ИИ-агента для выполнения сложной задачи в фоне' }
};

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
    const res: any[] = await invoke('get_aimodes', { project: props.currentProject });
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
    role_definition: 'Ты — вдумчивый творческий партнёр писателя. Помогай генерировать идеи, обсуждай сюжет и находи связи в мире.\nТвоё главное правило: будь живым собеседником. Не лезь в инструменты (поиск фактов), пока не убедишься, что вопрос касается конкретных данных лора. Если задача неоднозначна — задай уточняющий вопрос.\nТвоя цель — вдохновлять и предлагать варианты развития истории.',
    custom_instructions: '',
    api_profile_id: null,
    allowed_tools: ['rag_search', 'search_entities', 'get_entity', 'get_relations', 'get_chapters_list', 'get_chapter', 'get_timeline', 'get_calendar', 'search_chat_history']
  },
  {
    slug: 'edit',
    name: 'Редактор',
    project_id: props.currentProject,
    is_global: false,
    role_definition: 'Ты — строгий редактор и строитель вселенной. У тебя есть права на изменение текста и данных (создание сущностей, связей, редактирование глав).\nПорядок работы:\n1. Изучи контекст (найди нужные сущности или главы).\n2. Опиши пользователю, что именно ты собираешься изменить или добавить.\n3. Внеси изменения через инструменты.\n4. Кратко сообщи о результате.\nНе вноси масштабных изменений без спроса. Действуй хирургически точно.',
    custom_instructions: '',
    api_profile_id: null,
    allowed_tools: availableTools.slice() // all tools
  },
  {
    slug: 'analyze',
    name: 'Аналитик',
    project_id: props.currentProject,
    is_global: false,
    role_definition: 'Ты — аналитик сюжета. Твоя задача находить логические дыры, противоречия, нарушенные таймлайны и забытые ружья Чехова.\nТы работаешь ТОЛЬКО в режиме чтения.\nИспользуй инструменты (таймлайн, связи, rag_search) для глубокого сбора данных. Найдя противоречие, структурно опиши его пользователю и предложи 2-3 варианта исправления, опираясь на принцип Объективного коррелята.',
    custom_instructions: '',
    api_profile_id: null,
    allowed_tools: ['rag_search', 'search_entities', 'get_entity', 'get_relations', 'get_chapters_list', 'get_chapter', 'get_timeline', 'get_calendar', 'get_entity_evolution', 'get_relation_history', 'find_contradictions', 'search_chat_history']
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
  saveMessage.value = 'Сохранение...';
  try {
    await invoke('save_aimode', { data: activeMode.value });
    saveMessage.value = 'Успешно сохранено!';
    isNewMode.value = false;
    setTimeout(() => saveMessage.value = '', 2000);
  } catch (e) {
    console.error("Failed to save mode", e);
    saveMessage.value = 'Ошибка при сохранении';
  }
};

const deleteMode = async () => {
  if (!activeMode.value || activeMode.value.is_global) return;
  if (!confirm('Вы уверены, что хотите удалить этот режим?')) return;
  
  try {
    await invoke('delete_aimode', { id: activeMode.value.slug });
    modes.value = modes.value.filter(m => m.slug !== activeModeSlug.value);
    activeModeSlug.value = modes.value.length > 0 ? modes.value[0].slug : '';
  } catch (e) {
    console.error("Failed to delete mode", e);
    alert('Ошибка при удалении');
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
