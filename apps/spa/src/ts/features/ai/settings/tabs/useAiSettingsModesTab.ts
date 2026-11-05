import { ref, onMounted } from 'vue';
import type { AiProfile } from '@/features/ai/types/ai.types';
import { aiProfilesApi } from '../../api/aiProfiles.api';

export interface AiMode {
  id?: string;
  slug: string;
  name: string;
  role_definition: string;
  custom_instructions?: string;
  allowed_tools?: string[];
  api_profile_id?: string | null;
  is_global?: boolean;
  project_id?: string;
}

export interface AiSettingsModesTabProps {
  currentProject: string;
}

export interface AiSettingsModesTabEmits {
  (e: 'mode-saved', slug: string): void;
}

export const defaultSystemModes: AiMode[] = [
  {
    slug: 'chat',
    name: 'Свободный чат',
    role_definition: 'Ты — дружелюбный творческий собеседник и помощник писателя. Отвечай подробно, по делу, помогай развивать идеи.',
    is_global: true
  },
  {
    slug: 'writer',
    name: 'Соавтор (Генерация прозы)',
    role_definition: 'Ты — опытный писатель художественной литературы. Пиши выразительно, кинематографично, соблюдай принцип "показывай, а не рассказывай".',
    is_global: true
  },
  {
    slug: 'editor',
    name: 'Литературный редактор',
    role_definition: 'Ты — строгий литературный редактор. Находи повторы, канцелярит, стилистические сбои и логические дыры в тексте.',
    is_global: true
  },
  {
    slug: 'lore_master',
    name: 'Хранитель лора (Архивариус)',
    role_definition: 'Ты — Хранитель Энциклопедии Мира. Твоя задача — строго следить за каноном, проверять хронологию и родственные связи персонажей.',
    is_global: true
  }
];

export function useAiSettingsModesTab(
  props: AiSettingsModesTabProps,
  emit: AiSettingsModesTabEmits
) {
  const isLoading = ref(true);
  const modes = ref<AiMode[]>([]);
  const activeModeSlug = ref<string>('chat');
  const activeMode = ref<AiMode | null>(null);
  const isNewMode = ref(false);
  const profiles = ref<AiProfile[]>([]);

  const loadProfiles = async () => {
    try {
      if (props.currentProject) {
        profiles.value = await aiProfilesApi.getProfiles(props.currentProject);
      }
    } catch (e) {
      console.error('Ошибка загрузки профилей:', e);
    }
  };

  const onModeChange = () => {
    isNewMode.value = false;
    const found = modes.value.find(m => m.slug === activeModeSlug.value);
    if (found) {
      activeMode.value = { ...found };
    } else if (modes.value.length > 0) {
      activeMode.value = { ...modes.value[0] };
      activeModeSlug.value = modes.value[0].slug;
    }
  };

  const loadModes = async () => {
    isLoading.value = true;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const custom = await invoke<AiMode[]>('get_ai_modes', { projectId: props.currentProject || null }).catch(() => []);
      modes.value = [...defaultSystemModes, ...(custom || [])];
      onModeChange();
    } catch (e) {
      console.error('Ошибка загрузки режимов:', e);
      modes.value = [...defaultSystemModes];
      onModeChange();
    } finally {
      isLoading.value = false;
    }
  };

  const createNewMode = () => {
    isNewMode.value = true;
    activeMode.value = {
      slug: 'custom_' + Date.now().toString().slice(-4),
      name: 'Новый режим',
      role_definition: '',
      custom_instructions: '',
      is_global: false,
      project_id: props.currentProject
    };
    activeModeSlug.value = activeMode.value.slug;
  };

  const saveMode = async () => {
    if (!activeMode.value) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_ai_mode', { mode: activeMode.value, projectId: props.currentProject || null });
      isNewMode.value = false;
      await loadModes();
      emit('mode-saved', activeMode.value.slug);
      const { appAlert } = await import('@worldwiki/components');
      appAlert('Режим успешно сохранён!');
    } catch (e) {
      console.error('Ошибка сохранения режима:', e);
      const { appAlert } = await import('@worldwiki/components');
      appAlert('Не удалось сохранить режим: ' + e);
    }
  };

  const deleteMode = async () => {
    if (!activeMode.value || activeMode.value.is_global) return;
    const { appConfirm } = await import('@worldwiki/components');
    if (!await appConfirm(`Удалить режим "${activeMode.value.name}"?`)) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_ai_mode', { slug: activeMode.value.slug, projectId: props.currentProject || null });
      activeModeSlug.value = 'chat';
      await loadModes();
    } catch (e) {
      console.error('Ошибка удаления режима:', e);
    }
  };

  onMounted(async () => {
    await loadProfiles();
    await loadModes();
  });

  return {
    isLoading,
    modes,
    activeModeSlug,
    activeMode,
    isNewMode,
    profiles,
    onModeChange,
    createNewMode,
    saveMode,
    deleteMode
  };
}
