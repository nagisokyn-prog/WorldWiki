<template>
  <div class="settings-live-preview" :style="previewStyles">
    <div class="preview-container">
      <div class="preview-sidebar" :class="{ 'right-side': settings.layout.sidebarPos === 'row-reverse' }">
        <div class="preview-sidebar-header"></div>
        <div class="preview-sidebar-item active"></div>
        <div class="preview-sidebar-item"></div>
        <div class="preview-sidebar-item"></div>
      </div>
      
      <div class="preview-main">
        <div class="preview-header">
          <div class="preview-title">{{ t('settings.preview.title') }}</div>
        </div>
        
        <div class="preview-content">
          <div class="preview-card">
            <div class="preview-text-line title"></div>
            <div class="preview-text-line"></div>
            <div class="preview-text-line short"></div>
            
            <div class="preview-button">{{ t('settings.preview.button') }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="preview-label">{{ t('settings.preview.label') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';

const { t } = useI18n();

const props = defineProps<{
  settings: AppSettings;
}>();

const previewStyles = computed(() => {
  const c = props.settings.colors;
  const s = props.settings;
  return {
    '--bg-base': c.bgBase,
    '--bg-secondary': c.bgSecondary,
    '--bg-panel': c.bgPanel,
    '--text-main': c.textMain,
    '--text-muted': c.textMuted,
    '--border-color': c.borderColor,
    '--shadow-color': c.shadowColor,
    '--accent-color': c.accent,
    '--accent-text': c.accentText,
    '--preview-font': s.fonts?.family || 'inherit',
    '--preview-padding': ((s.spacing?.density || 1) * 16) + 'px',
    '--preview-card-radius': (s.radii?.card || 8) + 'px',
    '--preview-glass-blur': (s.glass?.blur || 0) + 'px',
    '--preview-card-shadow': `0 ${s.shadows?.islandY || 4}px ${s.shadows?.islandBlur || 12}px var(--shadow-color)`,
    '--preview-btn-radius': (s.radii?.btn || 4) + 'px'
  } as Record<string, string>;
});
</script>

<style scoped src="@worldwiki/resources/styles/components/SettingsLivePreview.css"></style>
