<template>
  <div class="settings-live-preview" :style="previewStyles">
    <div class="preview-container">
      <div class="preview-sidebar" :class="{ 'right-side': settings?.layout?.sidebarPos === 'row-reverse' }">
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
import type { AppSettings } from '../../../ts/types/settings.js';
import { useSettingsLivePreview } from './useSettingsLivePreview';

const props = defineProps<{
  settings: AppSettings;
}>();

const { t, previewStyles } = useSettingsLivePreview(() => props.settings);
</script>

<style scoped src="@worldwiki/resources/styles/components/SettingsLivePreview.css"></style>
