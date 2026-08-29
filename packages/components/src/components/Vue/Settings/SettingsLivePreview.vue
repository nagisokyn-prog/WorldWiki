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

<style scoped>
.settings-live-preview {
  position: relative;
  width: 100%;
  height: 200px;
  background: var(--bg-base);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
}

.preview-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

.preview-sidebar {
  width: 60px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
}
.preview-sidebar.right-side {
  order: 2;
  border-right: none;
  border-left: 1px solid var(--border-color);
}

.preview-sidebar-header {
  height: 12px;
  background: var(--text-muted);
  opacity: 0.3;
  border-radius: 4px;
  margin-bottom: 8px;
}

.preview-sidebar-item {
  height: 16px;
  background: var(--text-muted);
  opacity: 0.2;
  border-radius: 4px;
}
.preview-sidebar-item.active {
  opacity: 0.5;
  background: var(--accent-color);
}

.preview-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  position: relative;
}

.preview-header {
  height: 36px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--bg-panel);
}

.preview-title {
  color: var(--text-main);
  font-weight: 600;
  font-family: var(--preview-font, inherit);
  font-size: 14px;
}

.preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--preview-padding, 16px);
}

.preview-card {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--preview-card-radius, 8px);
  background: var(--bg-panel);
  backdrop-filter: blur(var(--preview-glass-blur, 0px));
  box-shadow: var(--preview-card-shadow, none);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-text-line {
  height: 8px;
  background: var(--text-muted);
  opacity: 0.4;
  border-radius: 4px;
  width: 100%;
}
.preview-text-line.title {
  height: 12px;
  width: 40%;
  opacity: 0.7;
}
.preview-text-line.short {
  width: 70%;
}

.preview-button {
  align-self: flex-start;
  padding: 6px 12px;
  background: var(--accent-color);
  color: var(--accent-text);
  font-size: 10px;
  font-weight: bold;
  margin-top: 4px;
  border-radius: var(--preview-btn-radius, 4px);
}

.preview-label {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--modal-backdrop);
  color: var(--accent-text);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  z-index: 2;
}
</style>
