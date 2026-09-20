<template>
  <div class="models-tab">
    <div class="tab-intro">
      <h3>Настройка моделей и логики генерации</h3>
      <p class="text-muted">
        Выберите роли моделей для вашего творчества. Вы можете использовать мощную облачную модель для диалогов и локальную модель для мгновенного поиска по лору.
      </p>
    </div>

    <div v-if="localSettings" class="models-config-grid">
      <!-- Блок 1: Основная модель для чата и письма -->
      <AiPrimaryModelCard
        :local-settings="localSettings"
        :available-model-options="availableModelOptions"
        :is-fetching-models="isFetchingModels"
        :fetch-error="fetchError"
        :active-profile="activeProfile"
        @fetch-models="$emit('fetch-models', $event)"
      />

      <!-- Блок 2: База знаний и Auto-RAG -->
      <AiRagConfigCard
        :local-settings="localSettings"
        :installed-models="installedModels"
        :is-custom-embed-path="isCustomEmbedPath"
        :custom-embed-input="customEmbedInput"
        @custom-embed-input="onCustomEmbedInput"
      />

      <!-- Блок 3: Параметры генерации -->
      <AiInferenceParamsCard
        :local-settings="localSettings"
      />

      <div class="form-actions">
        <button class="btn-primary" @click="handleSave">
          <i class="fas fa-check"></i> Сохранить настройки моделей
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AiPrimaryModelCard from './components/AiPrimaryModelCard.vue';
import AiRagConfigCard from './components/AiRagConfigCard.vue';
import AiInferenceParamsCard from './components/AiInferenceParamsCard.vue';
import { 
  useAiSettingsModelsTab, 
  type AiSettingsModelsTabProps, 
  type AiSettingsModelsTabEmits 
} from './useAiSettingsModelsTab';

const props = defineProps<AiSettingsModelsTabProps>();
const emit = defineEmits<AiSettingsModelsTabEmits>();

const {
  localSettings,
  availableModelOptions,
  isCustomEmbedPath,
  customEmbedInput,
  onCustomEmbedInput,
  handleSave
} = useAiSettingsModelsTab(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsModelsTab.css"></style>
