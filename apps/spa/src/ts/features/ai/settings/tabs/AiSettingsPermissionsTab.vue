<template>
  <div class="permissions-tab">
    <div class="tab-intro">
      <h3>Разрешения и безопасность инструментов</h3>
      <p class="text-muted">
        Определите, какие действия ИИ-ассистент может выполнять автоматически, а для каких потребуется ваше ручное подтверждение.
      </p>
    </div>

    <div class="presets-card">
      <span class="presets-title">Быстрые пресеты безопасности:</span>
      <div class="presets-buttons">
        <button 
          class="preset-btn" 
          :class="{ active: currentPreset === 'strict' }"
          @click="applyPreset('strict')"
        >
          <i class="fas fa-lock preset-icon text-warning"></i>
          <div class="preset-info">
            <span class="preset-name">Параноидальный</span>
            <span class="preset-desc">Спрашивать обо всем, кроме чтения</span>
          </div>
        </button>

        <button 
          class="preset-btn" 
          :class="{ active: currentPreset === 'balanced' }"
          @click="applyPreset('balanced')"
        >
          <i class="fas fa-balance-scale preset-icon text-primary"></i>
          <div class="preset-info">
            <span class="preset-name">Сбалансированный</span>
            <span class="preset-desc">Разрешить поиск и чтение, подтверждать запись</span>
          </div>
        </button>

        <button 
          class="preset-btn" 
          :class="{ active: currentPreset === 'full_auto' }"
          @click="applyPreset('full_auto')"
        >
          <i class="fas fa-bolt preset-icon text-success"></i>
          <div class="preset-info">
            <span class="preset-name">Автономный соавтор</span>
            <span class="preset-desc">Полный доступ (кроме системных команд)</span>
          </div>
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i> Загрузка каталога инструментов...
    </div>

    <div v-else class="categories-list">
      <div v-for="cat in categories" :key="cat.key" class="category-card">
        <div class="category-header">
          <i class="fas" :class="cat.icon"></i>
          <h4>{{ cat.title }}</h4>
        </div>

        <div class="tools-table">
          <div v-for="tool in getToolsByCategory(cat.key)" :key="tool.id" class="tool-row">
            <div class="tool-info">
              <div class="tool-name-wrap">
                <span class="tool-name">{{ tool.name }}</span>
                <span class="risk-badge" :class="'risk-' + tool.risk">
                  {{ getRiskLabel(tool.risk) }}
                </span>
              </div>
              <span class="tool-desc">{{ tool.description }}</span>
            </div>

            <div class="tool-action">
              <select 
                v-model="permissionsMap[tool.id]" 
                class="input-base perm-select"
                @change="handlePermissionChange(tool.id, permissionsMap[tool.id])"
              >
                <option value="allow">✅ Всегда разрешать</option>
                <option value="ask">⚠️ Спрашивать каждый раз</option>
                <option value="deny">🚫 Запретить навсегда</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { PermissionLevel, RiskLevel, ToolCategory, ToolPermissionConfig } from '../../types/ai.types';

const emit = defineEmits(['save-permissions']);

const isLoading = ref(true);
const tools = ref<ToolPermissionConfig[]>([]);
const permissionsMap = ref<Record<string, PermissionLevel>>({});

const categories: { key: ToolCategory; title: string; icon: string }[] = [
  { key: 'read', title: 'Чтение данных и лора проекта', icon: 'fa-book-open text-primary' },
  { key: 'analytics', title: 'Аналитика и поиск противоречий', icon: 'fa-chart-line text-accent' },
  { key: 'edit', title: 'Редактирование сущностей и глав', icon: 'fa-pen-nib text-warning' },
  { key: 'system', title: 'Системные операции', icon: 'fa-terminal text-danger' },
];

onMounted(async () => {
  await loadToolsCatalog();
});

const loadToolsCatalog = async () => {
  isLoading.value = true;
  try {
    const raw = await invoke<ToolPermissionConfig[]>('get_tool_permissions_catalog');
    tools.value = raw || [];
    
    // Initialize permissions map from default or user levels
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

const currentPreset = ref<string | null>('balanced');

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
  currentPreset.value = null; // Custom
  try {
    await invoke('save_tool_permission', { toolId, level });
    emit('save-permissions', permissionsMap.value);
  } catch (e) {
    console.error('Ошибка обновления права инструмента:', e);
  }
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsPermissionsTab.css"></style>
