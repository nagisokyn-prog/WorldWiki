<template>
  <div class="permissions-tab">
    <div class="tab-intro">
      <h3>Инструменты и права доступа</h3>
      <p class="text-muted">
        Определите, какие действия ИИ может выполнять автоматически, для каких требуется ваше подтверждение, а какие строго запрещены.
      </p>
    </div>

    <!-- Быстрые пресеты -->
    <div class="presets-card">
      <span class="presets-title">Быстрые профили безопасности:</span>
      <div class="presets-buttons">
        <button class="preset-btn" @click="applyPreset('balanced')">
          <i class="fas fa-shield-alt text-primary"></i>
          <div>
            <span class="p-title">Рекомендуемый (Баланс)</span>
            <span class="p-desc">Авто-чтение лора, подтверждение при правках</span>
          </div>
        </button>
        <button class="preset-btn" @click="applyPreset('strict')">
          <i class="fas fa-lock text-warning"></i>
          <div>
            <span class="p-title">Строгий контроль</span>
            <span class="p-desc">Спрашивать подтверждение на любое действие</span>
          </div>
        </button>
        <button class="preset-btn" @click="applyPreset('autopilot')">
          <i class="fas fa-bolt text-success"></i>
          <div>
            <span class="p-title">Автопилот</span>
            <span class="p-desc">Максимальная скорость работы без лишних окон</span>
          </div>
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i> Загрузка каталога инструментов...
    </div>

    <div v-else class="categories-list">
      <!-- Группа инструментов -->
      <div v-for="cat in categories" :key="cat.key" class="category-card">
        <div class="category-header">
          <div class="cat-title-row">
            <i class="fas" :class="cat.icon"></i>
            <h4>{{ cat.title }}</h4>
          </div>
          <span class="cat-count">{{ getToolsByCategory(cat.key).length }} инструментов</span>
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

            <div class="tool-select-wrap">
              <select 
                v-model="permissionsMap[tool.id]" 
                class="input-base perm-select"
                :class="'level-' + permissionsMap[tool.id]"
              >
                <option value="allow">🟢 Разрешить</option>
                <option value="ask">🟡 Спрашивать</option>
                <option value="deny">🔴 Запретить</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions" style="margin-top: 10px;">
        <button class="btn-primary" @click="savePermissions">
          <i class="fas fa-check"></i> Сохранить права доступа
        </button>
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
  return tools.value.filter(t => t.category === cat);
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

const applyPreset = (preset: 'balanced' | 'strict' | 'autopilot') => {
  const map = { ...permissionsMap.value };
  for (const t of tools.value) {
    if (preset === 'strict') {
      map[t.id] = t.category === 'system' ? 'deny' : 'ask';
    } else if (preset === 'autopilot') {
      map[t.id] = t.category === 'system' ? 'ask' : 'allow';
    } else {
      // balanced
      if (t.category === 'read' || t.category === 'analytics') {
        map[t.id] = 'allow';
      } else if (t.category === 'edit') {
        map[t.id] = 'ask';
      } else {
        map[t.id] = 'deny';
      }
    }
  }
  permissionsMap.value = map;
};

const savePermissions = async () => {
  try {
    // Save to localstorage or DB
    localStorage.setItem('worldwiki_ai_permissions', JSON.stringify(permissionsMap.value));
    emit('save-permissions');
  } catch (e) {
    console.error('Ошибка сохранения прав:', e);
  }
};
</script>

<style scoped>
.permissions-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.tab-intro h3 {
  margin: 0 0 6px 0;
  font-size: 18px;
  color: var(--text-color, #fff);
}
.text-muted {
  color: var(--text-muted, #8b949e);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}
.presets-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.presets-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #e6edf3);
}
.presets-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.preset-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  transition: all 0.2s ease;
}
.preset-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}
.p-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #fff);
}
.p-desc {
  display: block;
  font-size: 11px;
  color: var(--text-muted, #8b949e);
  margin-top: 2px;
}
.categories-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.category-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 8px;
}
.cat-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cat-title-row h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color, #e6edf3);
}
.cat-count {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.tools-table {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tool-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  gap: 16px;
}
.tool-row:hover {
  background: rgba(255, 255, 255, 0.04);
}
.tool-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}
.tool-name-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #fff);
}
.risk-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}
.risk-low {
  background: rgba(63, 185, 80, 0.15);
  color: #3fb950;
}
.risk-medium {
  background: rgba(210, 153, 34, 0.15);
  color: #d29922;
}
.risk-high {
  background: rgba(248, 81, 73, 0.15);
  color: #f85149;
}
.risk-critical {
  background: rgba(248, 81, 73, 0.3);
  color: #ff7b72;
}
.tool-desc {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.perm-select {
  font-size: 12px;
  padding: 5px 10px;
  min-width: 140px;
}
.text-primary { color: #58a6ff; }
.text-accent { color: #bc8cff; }
.text-warning { color: #d29922; }
.text-danger { color: #f85149; }
.text-success { color: #3fb950; }
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-muted, #8b949e);
  gap: 10px;
}
</style>
