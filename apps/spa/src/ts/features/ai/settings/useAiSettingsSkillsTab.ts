import { ref, computed, onMounted } from 'vue';
import { invoke } from '@worldwiki/components';
import type { AiSkillItem, AiSettingsSkillsTabProps, AiSettingsSkillsTabEmits } from './AiSettingsSkillsTab.model';
import { DEFAULT_BUILTIN_SKILLS } from '../skills/defaultBuiltinSkills';

function generateSkillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ai_skills:usr_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `ai_skills:usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useAiSettingsSkillsTab(
  props: AiSettingsSkillsTabProps,
  emit: AiSettingsSkillsTabEmits
) {
  const skills = ref<AiSkillItem[]>([]);
  const isLoading = ref(false);
  const searchQuery = ref('');
  const isEditing = ref(false);
  const editingSkill = ref<Partial<AiSkillItem>>({});
  const newTriggerInput = ref('');

  const filteredSkills = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return skills.value;
    return skills.value.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.triggers?.some((t) => t.toLowerCase().includes(q))
    );
  });

  const loadSkills = async () => {
    isLoading.value = true;
    try {
      const res = await invoke<AiSkillItem[]>('get_aiskills', {
        project: props.currentProject || 'global'
      }).catch(() => null);

      if (res && res.length > 0) {
        // Объединяем встроенные навыки с сохраненными в БД
        const builtinMap = new Map<string, AiSkillItem>(
          DEFAULT_BUILTIN_SKILLS.map((s) => [s.id, s])
        );
        const merged: AiSkillItem[] = [];

        for (const item of res) {
          if (builtinMap.has(item.id)) {
            // Оверлей сохраненных настроек над встроенным
            const def = builtinMap.get(item.id)!;
            merged.push({
              ...def,
              ...item,
              triggers: item.triggers && item.triggers.length > 0 ? item.triggers : def.triggers
            });
            builtinMap.delete(item.id);
          } else {
            merged.push(item);
          }
        }

        // Добавляем оставшиеся встроенные
        for (const def of builtinMap.values()) {
          merged.unshift(def);
        }

        skills.value = merged;
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
      triggers: [],
      is_auto_trigger: true,
      priority: 10,
      is_unlocked: true,
      is_custom_author_style: true
    };
    newTriggerInput.value = '';
    isEditing.value = true;
  };

  const openEditModal = (skill: AiSkillItem) => {
    editingSkill.value = {
      ...skill,
      triggers: skill.triggers ? [...skill.triggers] : []
    };
    newTriggerInput.value = '';
    isEditing.value = true;
  };

  const closeModal = () => {
    isEditing.value = false;
    editingSkill.value = {};
    newTriggerInput.value = '';
  };

  const addTrigger = () => {
    const val = newTriggerInput.value.trim().toLowerCase();
    if (!val) return;

    if (!editingSkill.value.triggers) {
      editingSkill.value.triggers = [];
    }

    if (!editingSkill.value.triggers.includes(val)) {
      editingSkill.value.triggers.push(val);
    }
    newTriggerInput.value = '';
  };

  const removeTrigger = (trigger: string) => {
    if (!editingSkill.value.triggers) return;
    editingSkill.value.triggers = editingSkill.value.triggers.filter((t) => t !== trigger);
  };

  const saveSkill = async () => {
    if (!editingSkill.value.name?.trim()) return;

    // Если в инпуте остался текст триггера, добавим его перед сохранением
    if (newTriggerInput.value.trim()) {
      addTrigger();
    }

    const isNew = !editingSkill.value.id;
    const skillId = editingSkill.value.id || generateSkillId();

    const payload: AiSkillItem = {
      id: skillId,
      project_id: editingSkill.value.project_id || (props.currentProject || 'global'),
      name: editingSkill.value.name.trim(),
      description: editingSkill.value.description?.trim() || '',
      prompt_text: editingSkill.value.prompt_text?.trim() || '',
      triggers: editingSkill.value.triggers || [],
      is_auto_trigger: editingSkill.value.is_auto_trigger ?? true,
      priority: editingSkill.value.priority ?? 10,
      is_unlocked: editingSkill.value.is_unlocked ?? true,
      is_custom_author_style: isNew ? true : (editingSkill.value.is_custom_author_style ?? true),
      is_builtin: editingSkill.value.is_builtin ?? false,
      file_path: editingSkill.value.file_path
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
    newTriggerInput,
    loadSkills,
    openCreateModal,
    openEditModal,
    closeModal,
    addTrigger,
    removeTrigger,
    saveSkill,
    deleteSkill
  };
}
