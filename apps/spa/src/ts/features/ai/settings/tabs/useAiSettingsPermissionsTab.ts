import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { PermissionLevel, RiskLevel, ToolCategory, ToolPermissionConfig } from '@/features/ai/types/ai.types';

export interface AiSettingsPermissionsTabEmits {
  (e: 'save-permissions', permissions: Record<string, PermissionLevel>): void;
}

const ALL_CATEGORIES: { key: ToolCategory; title: string; icon: string }[] = [
  { key: 'read', title: 'Чтение данных и лора проекта', icon: 'fa-book-open text-primary' },
  { key: 'edit', title: 'Редактирование сущностей и глав', icon: 'fa-pen-nib text-warning' },
];

export function useAiSettingsPermissionsTab(emit: AiSettingsPermissionsTabEmits) {
  const isLoading = ref(true);
  const tools = ref<ToolPermissionConfig[]>([]);
  const permissionsMap = ref<Record<string, PermissionLevel>>({});
  const currentPreset = ref<string | null>('balanced');

  const categories = computed(() => {
    return ALL_CATEGORIES.filter((cat) => 
      tools.value.some((t: ToolPermissionConfig) => t.category === cat.key)
    );
  });

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

  const getToolDisplayName = (tool: ToolPermissionConfig) => {
    if (!tool.name) return tool.id;
    return tool.name.replace(/\s*\([^)]*\)/g, '').trim();
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
        permissionsMap.value[t.id] = t.category === 'read' ? 'allow' : 'ask';
      } else if (preset === 'full_auto') {
        permissionsMap.value[t.id] = 'allow';
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

  const categoriesWithTools = computed(() => {
    return categories.value.map((cat) => ({
      ...cat,
      tools: tools.value
        .filter((t) => t.category === cat.key)
        .map((tool) => ({
          ...tool,
          displayName: getToolDisplayName(tool),
          riskLabel: getRiskLabel(tool.risk),
        })),
    }));
  });

  return {
    isLoading,
    tools,
    permissionsMap,
    categories,
    categoriesWithTools,
    currentPreset,
    getToolsByCategory,
    getToolDisplayName,
    getRiskLabel,
    applyPreset,
    handlePermissionChange
  };
}
