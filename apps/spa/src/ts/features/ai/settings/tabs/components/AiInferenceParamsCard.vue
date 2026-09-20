<template>
  <div class="config-card">
    <div class="card-header">
      <i class="fas fa-sliders-h text-primary"></i>
      <h4>Параметры инференса и креативности</h4>
    </div>

    <div class="form-row-2">
      <div class="form-group">
        <div class="slider-header">
          <label>Температура (Креативность)</label>
          <span class="slider-value">{{ localSettings.temperature }}</span>
        </div>
        <input 
          :value="localSettings.temperature" 
          type="range" 
          min="0" 
          max="2" 
          step="0.05" 
          class="range-slider" 
          @input="$emit('update-setting', 'temperature', Number(($event.target as HTMLInputElement).value))"
        />
        <div class="slider-marks">
          <span>0.0 (Факты)</span>
          <span>0.7 (Баланс)</span>
          <span>1.5+ (Фантазия)</span>
        </div>
      </div>

      <div class="form-group">
        <div class="slider-header">
          <label>Top-P (Ядерная выборка)</label>
          <span class="slider-value">{{ localSettings.top_p }}</span>
        </div>
        <input 
          :value="localSettings.top_p" 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          class="range-slider" 
          @input="$emit('update-setting', 'top_p', Number(($event.target as HTMLInputElement).value))"
        />
        <div class="slider-marks">
          <span>0.1 (Строго)</span>
          <span>0.9 (Обычно)</span>
          <span>1.0 (Все токены)</span>
        </div>
      </div>
    </div>

    <div class="form-row-2 mt-2">
      <div class="form-group">
        <label>Максимум токенов ответа (Max Output Tokens)</label>
        <input 
          :value="localSettings.max_tokens" 
          type="number" 
          class="input-base" 
          placeholder="Например: 4096 (Оставьте пустым для авто)" 
          @input="$emit('update-setting', 'max_tokens', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined)"
        />
      </div>

      <div class="form-group">
        <label>Штраф за повторы (Presence / Frequency Penalty)</label>
        <input 
          :value="localSettings.frequency_penalty" 
          type="number" 
          step="0.1" 
          min="-2" 
          max="2" 
          class="input-base" 
          placeholder="0.0" 
          @input="$emit('update-setting', 'frequency_penalty', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : 0)"
        />
      </div>
    </div>

    <div class="form-group mt-2">
      <label>Уровень размышлений (Reasoning Effort)</label>
      <select 
        :value="localSettings.reasoning_effort || 'none'"
        class="input-base"
        @change="$emit('update-setting', 'reasoning_effort', ($event.target as HTMLSelectElement).value)"
      >
        <option value="none">Отключено (без мыслей)</option>
        <option value="low">Минимальный (low)</option>
        <option value="medium">Средний (medium)</option>
        <option value="high">Высокий (high)</option>
        <option value="max">Максимальный (max)</option>
      </select>
      <span class="field-hint">Для рассуждающих моделей (DeepSeek R1, Laguna, OpenAI o1/o3/o4, QwQ) через OpenRouter или OpenAI.</span>
    </div>

    <div class="form-group mt-1">
      <label class="toggle-row">
        <input 
          type="checkbox" 
          :checked="Boolean(localSettings.enable_streaming)"
          @change="$emit('update-setting', 'enable_streaming', ($event.target as HTMLInputElement).checked)"
        />
        <div class="toggle-text">
          <span class="toggle-title">Потоковая генерация ответов (Streaming)</span>
          <span class="toggle-desc">Показывает текст по буквам в реальном времени по мере создания нейросетью.</span>
        </div>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiProfileSettings } from '../../../types/ai.types';

defineProps<{
  localSettings: AiProfileSettings;
}>();

defineEmits<{
  (e: 'update-setting', key: keyof AiProfileSettings, val: unknown): void;
}>();
</script>
