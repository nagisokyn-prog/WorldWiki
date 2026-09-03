<template>
  <div class="settings-modal-content cinematic-settings">
    <div class="settings-layout">
      <!-- Навигация (AAA Style) -->
      <SettingsNavRail 
        :active-tab="activeTab"
        @update:active-tab="val => activeTab = val"
      />

      <!-- Контентная область с плавной сменой сцен -->
      <div class="settings-content-area">
        <div class="glass-card-container">
          <div class="glass-card-bg"></div>
          <div class="glass-card-content">
            <Transition name="scene" mode="out-in">
              <component 
                :is="activeComponent" 
                :settings="settings" 
                :save="save" 
                @pick-background-file="pickBackgroundFile"
              />
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { settingsService } from '../../ts/services/settings.service.js';
import { setLocale } from "../../ts/i18n.js";
import { open } from '@tauri-apps/plugin-dialog';
import type { AppSettings } from '../../ts/types/settings.js';

import type { Component } from 'vue';

// Импорт новых сцен
import SettingsNavRail from './Settings/SettingsNavRail.vue';
import SettingsAppearance from './Settings/SettingsAppearance.vue';
import SettingsInterface from './Settings/SettingsInterface.vue';
import SettingsMotion from './Settings/SettingsMotion.vue';
import SettingsTypography from './Settings/SettingsTypography.vue';
import SettingsEditor from './Settings/SettingsEditor.vue';
import SettingsPerformance from './Settings/SettingsPerformance.vue';

defineEmits(['close', 'back']);

const { t } = useI18n();

const activeTab = ref('appearance');
const settings = ref<AppSettings>(settingsService.getSettings());

const componentsMap: Record<string, Component> = {
  appearance: SettingsAppearance,
  interface: SettingsInterface,
  motion: SettingsMotion,
  typography: SettingsTypography,
  editor: SettingsEditor,
  performance: SettingsPerformance
};

const activeComponent = computed(() => componentsMap[activeTab.value] || SettingsAppearance);

const changeLocale = async (lang: 'ru' | 'en') => {
  settings.value.locale = lang;
  setLocale(lang);
  try {
    await settingsService.saveSettings(settings.value, true);
  } catch (e) {
    console.error('Failed to save locale setting:', e);
  }
};

const save = async () => {
  if (settings.value.locale !== settingsService.getSettings().locale) {
    setLocale(settings.value.locale as 'ru' | 'en');
  }
  try {
    await settingsService.saveSettings(settings.value);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

const pickBackgroundFile = async () => {
  if (!window.__TAURI__) return;
  const isVideo = settings.value.background?.type === 'video';
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: isVideo ? 'Video' : 'Image',
        extensions: isVideo ? ['mp4', 'webm'] : ['jpg', 'png', 'gif', 'jpeg', 'webp']
      }]
    });
    
    if (selected && typeof selected === 'string') {
      const invoke = window.__TAURI__?.core?.invoke;

      const applyPath = (rawPath: string) => {
        if (isVideo) {
          settings.value.background!.videoPath = rawPath;
        } else {
          settings.value.background!.imagePath = rawPath;
        }
        save();
      };

      if (invoke) {
        try {
          const savedPath = await invoke('copy_background_file', { sourcePath: selected });
          applyPath(savedPath as string);
        } catch (err) {
          console.warn('[background] copy_background_file failed, using original path:', err);
          applyPath(selected);
        }
      } else {
        applyPath(selected);
      }
    }
  } catch(e) {
    console.warn('Failed to invoke dialog plugin:', e);
  }
};

const resetSettings = () => {
  if (confirm(t('settings.confirmReset', 'Сбросить все настройки по умолчанию?'))) {
    settingsService.resetSettings();
    settings.value = settingsService.getSettings();
  }
};

onMounted(async () => {
  await settingsService.loadSettings();
  settings.value = settingsService.getSettings();
  
  settingsService.onChange((newSettings) => {
    settings.value = newSettings;
  });
});

defineExpose({
  activeTab,
  settings,
  changeLocale,
  resetSettings
});
</script>

<style scoped src="@worldwiki/resources/styles/components/Settings.css"></style>
