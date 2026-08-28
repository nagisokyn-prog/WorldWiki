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

<style scoped>
@import '@worldwiki/resources/styles/components/Vue_Settings.css';

/* Переопределение компоновки для нового Cinematic Settings */
.cinematic-settings .settings-layout {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--bg-base, #111);
}

.cinematic-settings .settings-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.cinematic-settings .glass-card-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 0;
  border-top: none;
  border-bottom: none;
  border-right: none;
}

.cinematic-settings .glass-card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 32px 40px;
}

/* Анимации перехода (Смена сцен) */
.scene-enter-active,
.scene-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.scene-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.scene-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* Общие стили для сцен */
:deep(.settings-scene) {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  overflow: hidden;
}

:deep(.scene-header), :deep(.settings-live-preview) {
  flex-shrink: 0;
}

:deep(.settings-grid) {
  flex: 1;
  overflow-y: auto;
  padding-right: 16px;
  margin-right: -16px;
}

:deep(.scene-header) {
  margin-bottom: 8px;
}
:deep(.scene-header h2) {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--text-main);
  letter-spacing: -0.02em;
}
:deep(.scene-desc) {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

:deep(.impact-badge) {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  margin-left: 8px;
  vertical-align: middle;
}
:deep(.impact-badge.cost-high) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
:deep(.impact-badge.cost-low) {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
:deep(.impact-badge.visual-high) {
  background: rgba(79, 172, 254, 0.1);
  color: #4facfe;
  border: 1px solid rgba(79, 172, 254, 0.2);
}

:deep(.settings-group) {
  background: var(--bg-panel, rgba(255,255,255,0.02));
  border: 1px solid var(--border-color, rgba(255,255,255,0.05));
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

:deep(.settings-group-title) {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

:deep(.control-row) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
}

:deep(.val-badge) {
  background: var(--accent-glow, rgba(139, 92, 246, 0.15));
  border: 1px solid var(--accent, #8b5cf6);
  padding: 4px 10px;
  border-radius: 12px;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--text-main, #ffffff);
  font-weight: 600;
}

:deep(.radio-group) {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

:deep(.radio-btn) {
  padding: 8px 16px;
  background: var(--bg-input, rgba(0, 0, 0, 0.4));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 8px);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--anim-speed, 0.2s) ease;
  user-select: none;
}

:deep(.radio-btn:hover) {
  border-color: var(--accent, #8b5cf6);
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.08);
}

:deep(.radio-btn.active) {
  background: var(--accent, #8b5cf6) !important;
  border-color: var(--accent, #8b5cf6) !important;
  color: #ffffff !important;
  font-weight: 700;
  box-shadow: 0 0 16px var(--accent-glow, rgba(139, 92, 246, 0.5));
}
</style>
