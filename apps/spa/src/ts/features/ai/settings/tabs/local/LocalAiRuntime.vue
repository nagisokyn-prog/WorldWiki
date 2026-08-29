<template>
  <div class="sub-pane">
    <div v-if="runtimeSettings" class="runtime-card">
      <h4>Параметры инференса llama.cpp</h4>
      <p class="text-muted">
        Тонкая настройка аппаратного ускорения и распределения памяти для локальных моделей.
      </p>

      <div class="form-row-2" style="margin-top: 14px;">
        <div class="form-group">
          <label>Размер контекста (Токены)</label>
          <input 
            v-model.number="runtimeSettings.n_ctx" 
            type="number" 
            class="input-base" 
            placeholder="8192" 
          />
          <span class="field-hint">Рекомендуется: 8192 или 16384.</span>
        </div>

        <div class="form-group">
          <label>Слои на GPU (GPU Offload Layers)</label>
          <input 
            v-model.number="runtimeSettings.n_gpu_layers" 
            type="number" 
            class="input-base" 
            placeholder="-1 (Все слои на GPU)" 
          />
          <span class="field-hint">Значение -1 выгружает все слои на видеокарту.</span>
        </div>
      </div>

      <div class="form-group" style="margin-top: 14px;">
        <label class="toggle-row">
          <input 
            v-model="runtimeSettings.enable_tcq" 
            type="checkbox" 
          />
          <div class="toggle-text">
            <span class="toggle-title">Включить TurboQuant (TCQ) сжатие KV-кэша</span>
            <span class="toggle-desc">Снижает потребление видеопамяти кэшем на 60% без потери связности текста.</span>
          </div>
        </label>
      </div>

      <div class="form-actions" style="margin-top: 20px;">
        <button class="btn-primary" @click="handleSave">
          <i class="fas fa-check"></i> Сохранить параметры среды
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AiProfileSettings } from '../../../types/ai.types';

const props = defineProps<{
  localSettings: AiProfileSettings | null;
}>();

const emit = defineEmits<{
  (e: 'save-runtime', settings: AiProfileSettings): void;
}>();

const runtimeSettings = ref<AiProfileSettings | null>(null);

watch(() => props.localSettings, (val) => {
  if (val) {
    runtimeSettings.value = { ...val };
  } else {
    runtimeSettings.value = null;
  }
}, { immediate: true, deep: true });

const handleSave = () => {
  if (runtimeSettings.value) {
    emit('save-runtime', runtimeSettings.value);
  }
};
</script>
