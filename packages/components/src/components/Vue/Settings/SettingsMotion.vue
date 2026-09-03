<template>
  <div class="settings-scene">
    <div class="scene-header">
      <h2>◌ {{ t('settings.scenes.motion.title') }}</h2>
      <p class="scene-desc">{{ t('settings.scenes.motion.desc') }}</p>
    </div>

    <div v-auto-animate class="settings-grid">
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.animations', 'Анимации') }}</h3>
        
        <div class="control-row">
          <label>{{ t('settings.fields.animationsEnabled', 'Включить анимации') }}</label>
          <label class="toggle-switch"><input v-model="settings.animations.enabled" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
        
        <div class="control-row mt-3">
          <label>{{ t('settings.fields.animationSpeed', 'Скорость перехода (Универсальная)') }} <span class="impact-badge cost-high">Cost: Medium</span></label>
          <span class="val-badge">{{ settings.animations.speed }}s</span>
        </div>
        <input v-model.number="settings.animations.speed" type="range" min="0.1" max="1.0" step="0.05" class="interactive-el" :disabled="!settings.animations.enabled" @input="save()">
        
        <div class="control-row">
          <label>{{ t('settings.fields.entrance', 'Длительность появления (Entrance)') }}</label>
          <span class="val-badge">{{ settings.animations.entrance }}s</span>
        </div>
        <input v-model.number="settings.animations.entrance" type="range" min="0.1" max="2.0" step="0.1" class="interactive-el" :disabled="!settings.animations.enabled" @input="save()">
      </div>

      <div class="settings-group">
        <h3 class="form-label settings-group-title">Взаимодействия (Interactions)</h3>
        
        <div class="control-row">
          <label>{{ t('settings.fields.pulse', 'Эффект пульсации (Акценты)') }} <span class="impact-badge cost-high">Cost: Low</span></label>
          <label class="toggle-switch"><input v-model="settings.animations.pulse" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
        
        <div class="control-row mt-3"><label>{{ t('settings.fields.scalePush', 'Сжатие при нажатии') }}</label><span class="val-badge">{{ settings.animations.scalePush }}x</span></div>
        <input v-model.number="settings.animations.scalePush" type="range" min="0.8" max="1.0" step="0.01" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.scalePull', 'Увеличение при наведении') }}</label><span class="val-badge">{{ settings.animations.scalePull }}x</span></div>
        <input v-model.number="settings.animations.scalePull" type="range" min="1.0" max="1.2" step="0.01" class="interactive-el" @input="save()">
        
        <div class="control-row mt-3">
          <label>{{ t('settings.fields.inputFocusAnimation', 'Анимация фокуса полей ввода') }}</label>
          <label class="toggle-switch"><input v-model="settings.inputs.focusAnim" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
        
        <div class="control-row mt-2">
          <label>{{ t('settings.fields.hoverEffect', 'Кнопки: Увеличение при наведении') }}</label>
          <label class="toggle-switch"><input v-model="settings.buttons.hoverScale" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
        <div class="control-row mt-2">
          <label>{{ t('settings.fields.clickEffect', 'Кнопки: Сжатие при клике') }}</label>
          <label class="toggle-switch"><input v-model="settings.buttons.clickPress" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';

const { t } = useI18n();

defineProps<{
  settings: AppSettings;
  save: () => Promise<void>;
}>();
</script>
