import { ref, computed, onMounted } from 'vue';
import { invoke } from '@worldwiki/components';
import type { AiSkillItem, AiSettingsSkillsTabProps, AiSettingsSkillsTabEmits } from './AiSettingsSkillsTab.model';

const DEFAULT_BUILTIN_SKILLS: AiSkillItem[] = [
  {
    id: 'ai_skills:entity_type_creator',
    name: 'Конструктор типов сущностей',
    description: 'Пошаговое создание нового типа сущности на базе каталога блоков ui_editor.json с визуализацией через Mermaid MMD диаграмму.',
    prompt_text: 'Ты используешь эталонный навык "Конструктор типов сущностей". Перед созданием структуры всегда строй Mermaid MMD диаграмму вкладок и полей.',
    is_unlocked: true,
    is_custom_author_style: false
  }
];

export function useAiSettingsSkillsTab(
  props: AiSettingsSkillsTabProps,
  emit: AiSettingsSkillsTabEmits
) {
  const skills = ref<AiSkillItem[]>([]);
  const isLoading = ref(false);
  const searchQuery = ref('');
  const isEditing = ref(false);
  const editingSkill = ref<Partial<AiSkillItem>>({});

  const filteredSkills = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return skills.value;
    return skills.value.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  });

  const loadSkills = async () => {
    isLoading.value = true;
    try {
      const res = await invoke<AiSkillItem[]>('get_aiskills', {
        project: props.currentProject || 'global'
      }).catch(() => null);

      if (res && res.length > 0) {
        skills.value = res;
      } else {
        skills.value = [...DEFAULT_BUILTIN_SKILLS];
      }
    } catch (e) {
      console.warn('Failed to load ai skills from DB, using defaults:', e);
      skills.value = [...DEFAULT_BUILTIN_SKILLS];
    } finally {
      isLoading.value = false;
    }
  };

  const openCreateModal = () => {
    editingSkill.value = {
      name: '',
      description: '',
      prompt_text: '',
      is_unlocked: true,
      is_custom_author_style: true
    };
    isEditing.value = true;
  };

  const openEditModal = (skill: AiSkillItem) => {
    editingSkill.value = { ...skill };
    isEditing.value = true;
  };

  const closeModal = () => {
    isEditing.value = false;
    editingSkill.value = {};
  };

  const saveSkill = async () => {
    if (!editingSkill.value.name?.trim()) return;

    const payload: AiSkillItem = {
      id: editingSkill.value.id || `ai_skills:${Date.now()}`,
      project_id: props.currentProject || 'global',
      name: editingSkill.value.name.trim(),
      description: editingSkill.value.description?.trim() || '',
      prompt_text: editingSkill.value.prompt_text?.trim() || '',
      is_unlocked: editingSkill.value.is_unlocked ?? true,
      is_custom_author_style: true
    };

    try {
      await invoke('save_aiskill', {
        project: props.currentProject || 'global',
        data: payload
      }).catch(() => null);

      const idx = skills.value.findIndex((s) => s.id === payload.id);
      if (idx >= 0) {
        skills.value[idx] = payload;
      } else {
        skills.value.push(payload);
      }

      emit('skills-updated');
      closeModal();
    } catch (e) {
      console.error('Failed to save skill:', e);
    }
  };

  const deleteSkill = async (id: string) => {
    try {
      await invoke('delete_aiskill', {
        project: props.currentProject || 'global',
        id
      }).catch(() => null);

      skills.value = skills.value.filter((s) => s.id !== id);
      emit('skills-updated');
    } catch (e) {
      console.error('Failed to delete skill:', e);
    }
  };

  onMounted(() => {
    void loadSkills();
  });

  return {
    skills,
    filteredSkills,
    isLoading,
    searchQuery,
    isEditing,
    editingSkill,
    loadSkills,
    openCreateModal,
    openEditModal,
    closeModal,
    saveSkill,
    deleteSkill
  };
}
