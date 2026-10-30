<template>
  <div class="local-ai-tab">
    <!-- Монитор оборудования ПК -->
    <div class="hardware-banner">
      <div class="hw-item">
        <i class="fas fa-microchip hw-icon"></i>
        <div class="hw-details">
          <span class="hw-title">Оперативная память (RAM)</span>
          <span class="hw-val">{{ hardware?.free_ram_gb || 0 }} ГБ свободно из {{ hardware?.total_ram_gb || 0 }} ГБ</span>
        </div>
      </div>
      <div class="hw-item">
        <i class="fas fa-desktop hw-icon" :class="{ 'text-success': hardware?.is_gpu_available }"></i>
        <div class="hw-details">
          <span class="hw-title">Видеокарта и VRAM</span>
          <span class="hw-val">{{ hardware?.free_vram_gb || 0 }} ГБ свободно из {{ hardware?.total_vram_gb || 0 }} ГБ ({{ hardware?.gpu_name || 'GPU' }})</span>
        </div>
      </div>
      <button 
        class="chart-toggle-btn" 
        :class="{ active: showChart }"
        title="Показать / скрыть график ресурсов в реальном времени"
        @click="showChart = !showChart"
      >
        <i class="fas fa-chart-area"></i>
        <span>{{ showChart ? 'Скрыть график' : 'График ресурсов' }}</span>
      </button>
    </div>

    <!-- Живой график uPlot -->
    <HardwareMonitorChart v-if="showChart" :hardware="hardware" />

    <!-- Внутренние вкладки локального ИИ -->
    <div class="local-nav">
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'recommended' }" 
        @click="subTab = 'recommended'"
      >
        <i class="fas fa-star"></i> Рекомендованные
      </button>
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'library' }" 
        @click="subTab = 'library'"
      >
        <i class="fas fa-folder"></i> Моя библиотека ({{ installedModels.length }})
      </button>
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'explore' }" 
        @click="subTab = 'explore'"
      >
        <i class="fas fa-search"></i> Поиск на Hugging Face
      </button>
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'runtime' }" 
        @click="subTab = 'runtime'"
      >
        <i class="fas fa-cogs"></i> Среда выполнения
      </button>
    </div>

    <!-- 1. Рекомендованные модели -->
    <LocalAiRecommended
      v-if="subTab === 'recommended'"
      :recommended-models="recommendedModels"
      :download-progress="downloadProgress"
      :is-model-installed="isModelInstalled"
      @download="downloadModel"
    />

    <!-- 2. Моя библиотека моделей -->
    <LocalAiLibrary
      v-if="subTab === 'library'"
      :installed-models="installedModels"
      :local-settings="localSettings"
      :get-state-icon="getStateIcon"
      :get-state-label="getStateLabel"
      @switch-tab="tab => subTab = tab"
      @load="loadModel"
      @unload="unloadModel"
      @delete="deleteModel"
    />

    <!-- 3. Поиск по Hugging Face -->
    <LocalAiExplore
      v-if="subTab === 'explore'"
      v-model:search-query="searchQuery"
      v-model:hf-token="hfToken"
      :is-searching="isSearching"
      :hf-models="hfModels"
      :download-progress="downloadProgress"
      :is-model-installed="isModelInstalled"
      :format-number="formatNumber"
      @search-input="onSearchInput"
      @save-hf-token="saveHfToken"
      @download="downloadModel"
    />

    <!-- 4. Среда выполнения -->
    <LocalAiRuntime
      v-if="subTab === 'runtime'"
      :local-settings="localSettings"
      @save-runtime="handleSaveRuntime"
    />
  </div>
</template>

<script setup lang="ts">
import type { AiSettingsLocalTabProps, AiSettingsLocalTabEmits } from './AiSettingsLocalTab.model';
import HardwareMonitorChart from './HardwareMonitorChart.vue';
import LocalAiRecommended from './local/LocalAiRecommended.vue';
import LocalAiLibrary from './local/LocalAiLibrary.vue';
import LocalAiExplore from './local/LocalAiExplore.vue';
import LocalAiRuntime from './local/LocalAiRuntime.vue';
import { useLocalAiTab } from './local/useLocalAiTab';
import type { AiProfile, AiProfileSettings } from '../../types/ai.types';

const props = defineProps<AiSettingsLocalTabProps>();

const emit = defineEmits<AiSettingsLocalTabEmits>();

const {
  subTab,
  showChart,
  hardware,
  recommendedModels,
  installedModels,
  hfModels,
  searchQuery,
  isSearching,
  downloadProgress,
  localSettings,
  hfToken,
  saveHfToken,
  isModelInstalled,
  downloadModel,
  loadModel,
  unloadModel,
  deleteModel,
  onSearchInput,
  handleSaveRuntime,
  getStateIcon,
  getStateLabel,
  formatNumber
} = useLocalAiTab(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsLocalTab.css"></style>
