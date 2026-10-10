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
      <div v-for="cat in categoriesWithTools" :key="cat.key" class="category-card">
        <div class="category-header">
          <i class="fas" :class="cat.icon"></i>
          <h4>{{ cat.title }}</h4>
        </div>

        <div class="tools-table">
          <div v-for="tool in cat.tools" :key="tool.id" class="tool-row">
            <div class="tool-info">
              <div class="tool-name-wrap">
                <span class="tool-name">{{ tool.displayName }}</span>
                <span class="risk-badge" :class="'risk-' + tool.risk">
                  {{ tool.riskLabel }}
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
import { 
  useAiSettingsPermissionsTab, 
  type AiSettingsPermissionsTabEmits 
} from './useAiSettingsPermissionsTab';

const emit = defineEmits<AiSettingsPermissionsTabEmits>();

const {
  isLoading,
  permissionsMap,
  categoriesWithTools,
  currentPreset,
  applyPreset,
  handlePermissionChange
} = useAiSettingsPermissionsTab(emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsPermissionsTab.css"></style>
