<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div class="settings-scene">
    <div class="scene-header">
      <h2>Aa {{ t('settings.scenes.typography.title') }}</h2>
      <p class="scene-desc">{{ t('settings.scenes.typography.desc') }}</p>
    </div>

    <div v-auto-animate class="settings-grid">
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.fonts', 'Шрифты') }}</h3>
        
        <div class="control-row"><label>{{ t('settings.fields.fontFamily', 'Семейство шрифтов') }}</label></div>
        <div class="radio-group flex-col">
          <div 
            v-for="font in fontOptions" 
            :key="font.val" 
            class="radio-btn" 
            :class="{ active: settings.fonts.family === font.val }" 
            :style="{ fontFamily: font.val }" 
            @click="settings.fonts.family = font.val; save()"
          >
            {{ t(font.titleKey) }}
          </div>
        </div>
        
        <div class="control-row mt-4"><label>{{ t('settings.fields.fontSize', 'Размер шрифта') }}</label><span class="val-badge">{{ settings.fonts.size }}px</span></div>
        <input v-model.number="settings.fonts.size" type="range" min="12" max="24" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.fontLineHeight', 'Межстрочный интервал') }}</label><span class="val-badge">{{ settings.fonts.lineHeight }}</span></div>
        <input v-model.number="settings.fonts.lineHeight" type="range" min="1.0" max="2.0" step="0.1" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.fontLetterSpacing', 'Межбуквенный интервал') }}</label><span class="val-badge">{{ settings.fonts.letterSpacing }}px</span></div>
        <input v-model.number="settings.fonts.letterSpacing" type="range" min="-1" max="3" step="0.1" class="interactive-el" @input="save()">
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

const fontOptions = [
  { val: 'Inter', titleKey: 'settings.fonts.interDefault' },
  { val: 'Roboto', titleKey: 'settings.fonts.roboto' },
  { val: 'SF Pro Display', titleKey: 'settings.fonts.sfPro' },
  { val: 'Segoe UI', titleKey: 'settings.fonts.segoe' },
  { val: 'Fira Code', titleKey: 'settings.fonts.firaCode' }
];
</script>
