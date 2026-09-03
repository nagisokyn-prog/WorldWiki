<template>
  <div class="settings-scene">
    <div class="scene-header">
      <h2>✦ {{ t('settings.scenes.appearance.title') }}</h2>
      <p class="scene-desc">{{ t('settings.scenes.appearance.desc') }}</p>
    </div>

    <SettingsLivePreview :settings="settings" />

    <div v-auto-animate class="settings-grid">
      <!-- ТЕМА ОФОРМЛЕНИЯ -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.theme', 'Тема оформления') }}</h3>
        <ThemeSwitcher />
      </div>

      <!-- ФОН -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">Фон</h3>
        <div class="control-row"><label>Тип фона</label></div>
        <div class="radio-group flex-wrap gap-2">
          <div class="radio-btn" :class="{ active: settings.background?.type === 'none' }" @click="settings.background!.type = 'none'; save()">Нет</div>
          <div class="radio-btn" :class="{ active: settings.background?.type === 'color' }" @click="settings.background!.type = 'color'; save()">Цвет</div>
          <div class="radio-btn" :class="{ active: settings.background?.type === 'image' }" @click="settings.background!.type = 'image'; save()">Изображение</div>
          <div class="radio-btn" :class="{ active: settings.background?.type === 'video' }" @click="settings.background!.type = 'video'; save()">Видео</div>
        </div>
        
        <div v-if="settings.background?.type === 'image' || settings.background?.type === 'video'" class="mt-3">
          <button class="interactive-el btn-pick-bg" @click="$emit('pick-background-file')">Выбрать файл...</button>
          <div v-if="settings.background.type === 'image' && settings.background.imagePath" class="text-xs text-muted mt-1">{{ settings.background.imagePath }}</div>
          <div v-if="settings.background.type === 'video' && settings.background.videoPath" class="text-xs text-muted mt-1">{{ settings.background.videoPath }}</div>
        </div>

        <div class="control-row mt-3"><label>Прозрачность</label><span class="val-badge">{{ Math.round((settings.background?.opacity || 0) * 100) }}%</span></div>
        <input v-model.number="settings.background!.opacity" type="range" min="0" max="1" step="0.02" class="interactive-el" @input="save()">
        
        <div class="control-row">
          <label>Размытие <span class="impact-badge cost-high">Cost: High</span></label>
          <span class="val-badge">{{ settings.background?.blur || 0 }}px</span>
        </div>
        <input v-model.number="settings.background!.blur" type="range" min="0" max="50" class="interactive-el" @input="save()">
      </div>

      <!-- ПРОЗРАЧНОСТЬ И СТЕКЛО -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.glass', 'Прозрачность и стекло') }}</h3>
        
        <div class="control-row"><label>{{ t('settings.fields.islandAlpha', 'Прозрачность панелей') }}</label><span class="val-badge">{{ Math.round(settings.glass.islandAlpha * 100) }}%</span></div>
        <input v-model.number="settings.glass.islandAlpha" type="range" min="0" max="1" step="0.02" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.cardAlpha', 'Прозрачность карточек') }}</label><span class="val-badge">{{ Math.round(settings.glass.cardAlpha * 100) }}%</span></div>
        <input v-model.number="settings.glass.cardAlpha" type="range" min="0" max="1" step="0.02" class="interactive-el" @input="save()">

        <div class="control-row">
          <label>{{ t('settings.fields.blur', 'Размытие интерфейса') }} <span class="impact-badge cost-high">Cost: High</span> <span class="impact-badge visual-high">Visual: High</span></label>
          <span class="val-badge">{{ settings.glass.blur }}px</span>
        </div>
        <input v-model.number="settings.glass.blur" type="range" min="0" max="60" step="1" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.borderAlpha', 'Прозрачность рамок') }}</label><span class="val-badge">{{ Math.round(settings.glass.borderAlpha * 100) }}%</span></div>
        <input v-model.number="settings.glass.borderAlpha" type="range" min="0" max="1" step="0.02" class="interactive-el" @input="save()">
      </div>

      <!-- ЦВЕТОВАЯ СХЕМА -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.colors', 'Цветовая схема') }}</h3>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.bgBase', 'Базовый фон') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.bgBase)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('bgBase', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.bgBase" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.bgSecondary', 'Вторичный фон') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.bgSecondary)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('bgSecondary', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.bgSecondary" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.bgPanel', 'Фон панелей') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.bgPanel)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('bgPanel', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.bgPanel" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.bgInput', 'Фон инпутов') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.bgInput)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('bgInput', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.bgInput" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.textMain', 'Основной текст') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.textMain)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('textMain', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.textMain" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.textMuted', 'Приглушенный текст') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.textMuted)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('textMuted', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.textMuted" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.accent', 'Акцент') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.accent)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('accent', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.accent" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.accentHover', 'Акцент (Hover)') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.accentHover)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('accentHover', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.accentHover" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.accentText', 'Текст на акценте') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.accentText)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('accentText', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.accentText" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.borderColor', 'Границы') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.borderColor)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('borderColor', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.borderColor" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
        <div class="color-control"><span class="color-label">{{ t('settings.fields.shadowColor', 'Тени') }}</span><div class="color-control-inputs"><input type="color" :value="toHex(settings.colors.shadowColor)" class="interactive-el color-picker-input" @input="e => updateColorAlpha('shadowColor', (e.target as HTMLInputElement).value)"><input v-model="settings.colors.shadowColor" type="text" class="interactive-el color-text-input" @input="save()"></div></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';
import ThemeSwitcher from '../ThemeSwitcher.vue';
import SettingsLivePreview from './SettingsLivePreview.vue';
import { useSettingsAppearance } from './useSettingsAppearance';

const { t } = useI18n();

const settings = defineModel<AppSettings>('settings', { required: true });

const props = defineProps<{
  save: () => Promise<void>;
}>();

defineEmits<{
  (e: 'pick-background-file'): void;
}>();

const { toHex, updateColorAlpha } = useSettingsAppearance(() => settings.value, props.save);
</script>

<style scoped src="@worldwiki/resources/styles/components/SettingsAppearance.css"></style>
