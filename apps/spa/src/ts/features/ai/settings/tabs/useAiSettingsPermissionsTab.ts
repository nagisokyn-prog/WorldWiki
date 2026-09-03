import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { PermissionLevel, RiskLevel, ToolCategory, ToolPermissionConfig } from '../../types/ai.types';

export interface AiSettingsPermissionsTabEmits {
  (e: 'save-permissions', permissions: Record<string, PermissionLevel>): void;
}

export function useAiSettingsPermissionsTab(emit: AiSettingsPermissionsTabEmits) {
  const isLoading = ref(true);
  const tools = ref<ToolPermissionConfig[]>([]);
  const permissionsMap = ref<Record<string, PermissionLevel>>({});
  const currentPreset = ref<string | null>('balanced');

  const categories: { key: ToolCategory; title: string; icon: string }[] = [
    { key: 'read', title: 'Чтение данных и лора проекта', icon: 'fa-book-open text-primary' },
    { key: 'analytics', title: 'Аналитика и поиск противоречий', icon: 'fa-chart-line text-accent' },
    { key: 'edit', title: 'Редактирование сущностей и глав', icon: 'fa-pen-nib text-warning' },
    { key: 'system', title: 'Системные операции', icon: 'fa-terminal text-danger' },
  ];

  const loadToolsCatalog = async () => {
    isLoading.value = true;
    try {
      const raw = await invoke<ToolPermissionConfig[]>('get_tool_permissions_catalog');
      tools.value = raw || [];

      const map: Record<string, PermissionLevel> = {};
      for (const t of tools.value) {
        map[t.id] = t.user_level || t.default_level;
      }
      permissionsMap.value = map;
    } catch (e) {
      console.error('Ошибка загрузки каталога инструментов:', e);
    } finally {
      isLoading.value = false;
    }
  };

  const getToolsByCategory = (cat: ToolCategory) => {
    return tools.value.filter((t: ToolPermissionConfig) => t.category === cat);
  };

  const getRiskLabel = (risk: RiskLevel) => {
    const map: Record<RiskLevel, string> = {
      low: 'Низкий риск',
      medium: 'Средний риск',
      high: 'Высокий риск',
      critical: 'Критический',
    };
    return map[risk] || risk;
  };

  const applyPreset = async (preset: 'strict' | 'balanced' | 'full_auto') => {
    currentPreset.value = preset;
    for (const t of tools.value) {
      if (preset === 'strict') {
        permissionsMap.value[t.id] = t.category === 'read' ? 'allow' : 'ask';
      } else if (preset === 'balanced') {
        if (t.category === 'read' || t.category === 'analytics') {
          permissionsMap.value[t.id] = 'allow';
        } else {
          permissionsMap.value[t.id] = 'ask';
        }
      } else if (preset === 'full_auto') {
        if (t.category === 'system') {
          permissionsMap.value[t.id] = 'ask';
        } else {
          permissionsMap.value[t.id] = 'allow';
        }
      }
    }

    try {
      await invoke('save_all_tool_permissions', { permissions: permissionsMap.value });
      emit('save-permissions', permissionsMap.value);
    } catch (e) {
      console.error('Ошибка сохранения пресета прав:', e);
    }
  };

  const handlePermissionChange = async (toolId: string, level: PermissionLevel) => {
    currentPreset.value = null;
    try {
      await invoke('save_tool_permission', { toolId, level });
      emit('save-permissions', permissionsMap.value);
    } catch (e) {
      console.error('Ошибка обновления права инструмента:', e);
    }
  };

  onMounted(async () => {
    await loadToolsCatalog();
  });

  return {
    isLoading,
    tools,
    permissionsMap,
    categories,
    currentPreset,
    getToolsByCategory,
    getRiskLabel,
    applyPreset,
    handlePermissionChange
  };
}
