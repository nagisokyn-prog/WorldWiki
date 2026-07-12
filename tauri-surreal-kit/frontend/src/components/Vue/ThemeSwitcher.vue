<template>
  <div class="theme-switcher">
    <div class="theme-header">
      <h3>{{ t('settings.groupTitles.theme') }}</h3>
      <p class="theme-description">{{ t('settings.themeDescription') }}</p>
    </div>

    <div class="theme-options">
      <button
        class="theme-option"
        :class="{ active: currentTheme === 'dark' }"
        @click="switchToDark"
      >
        <div class="theme-preview dark-preview">
          <div class="preview-bg"></div>
          <div class="preview-text">🌙</div>
        </div>
        <span class="theme-label">{{ t('settings.themes.dark') }}</span>
        <span v-if="currentTheme === 'dark'" class="theme-active">✓</span>
      </button>

      <button
        class="theme-option"
        :class="{ active: currentTheme === 'light' }"
        @click="switchToLight"
      >
        <div class="theme-preview light-preview">
          <div class="preview-bg"></div>
          <div class="preview-text">☀️</div>
        </div>
        <span class="theme-label">{{ t('settings.themes.light') }}</span>
        <span v-if="currentTheme === 'light'" class="theme-active">✓</span>
      </button>

      <button
        v-for="themeName in customThemes"
        :key="themeName"
        class="theme-option"
        :class="{ active: currentTheme === themeName }"
        @click="switchToCustom(themeName)"
      >
        <div class="theme-preview custom-preview">
          <div class="preview-bg"></div>
          <div class="preview-text">🖌️</div>
        </div>
        <span class="theme-label">{{ themeName }}</span>
        <span v-if="currentTheme === themeName" class="theme-active">✓</span>
      </button>
    </div>

    <div class="theme-actions">
      <button class="btn btn-secondary btn-sm" style="width: 100%; margin-bottom: 16px;" @click="saveCurrentAsTheme">
        💾 {{ t('settings.saveTheme') }}
      </button>
    </div>

    <div v-if="isSaving" class="theme-saving">
      {{ t('settings.saving') }}
    </div>
    <div v-if="saveMessage" :class="['theme-message', saveMessage.type]">
      {{ saveMessage.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { settingsService } from '../../js/services/settings.service';

const { t } = useI18n();
const currentTheme = ref<string>('dark');
const isSaving = ref(false);
const saveMessage = ref<{ type: string; text: string } | null>(null);
const customThemes = ref<string[]>([]);

const loadCustomThemes = async () => {
  if (window.__TAURI__?.core) {
    try {
      customThemes.value = await window.__TAURI__.core.invoke('get_custom_themes');
    } catch (e) {
      console.error('Failed to load custom themes:', e);
    }
  }
};

onMounted(async () => {
  currentTheme.value = settingsService.getCurrentTheme();
  await loadCustomThemes();
});

const switchToDark = async () => {
  if (currentTheme.value === 'dark') return;
  isSaving.value = true;
  try {
    // Загружаем тёмную тему из settings.json
    let newSettings = settingsService.getSettings();
    if (window.__TAURI__?.core) {
      const themeSettings = await window.__TAURI__.core.invoke('load_theme', { theme: 'dark' });
      if (themeSettings) {
        newSettings = { ...newSettings, ...themeSettings, theme: 'dark' };
      } else {
        newSettings = { ...newSettings, ...settingsService.getDefaultSettings(), theme: 'dark' };
      }
    } else {
      newSettings = { ...newSettings, ...settingsService.getDefaultSettings(), theme: 'dark' };
    }
    
    // Сохраняем с указанием текущей темы
    await settingsService.saveSettings({ ...newSettings, theme: 'dark' });
    currentTheme.value = 'dark';
    saveMessage.value = { type: 'success', text: t('settings.themeActivated', { theme: t('settings.themes.dark') }) };
    setTimeout(() => { saveMessage.value = null; }, 2000);
  } catch (e) {
    console.error('Failed to switch theme:', e);
    saveMessage.value = { type: 'error', text: t('settings.themeActivationError') };
  } finally {
    isSaving.value = false;
  }
};

const switchToLight = async () => {
  if (currentTheme.value === 'light') return;
  isSaving.value = true;
  try {
    // Загружаем светлую тему из settings-light.json
    let newSettings = settingsService.getSettings();
    if (window.__TAURI__?.core) {
      const themeSettings = await window.__TAURI__.core.invoke('load_theme', { theme: 'light' });
      if (themeSettings) {
        newSettings = { ...newSettings, ...themeSettings, theme: 'light' };
      }
    }
    
    // Сохраняем с указанием текущей темы
    await settingsService.saveSettings({ ...newSettings, theme: 'light' });
    currentTheme.value = 'light';
    saveMessage.value = { type: 'success', text: t('settings.themeActivated', { theme: t('settings.themes.light') }) };
    setTimeout(() => { saveMessage.value = null; }, 2000);
  } catch (e) {
    console.error('Failed to switch theme:', e);
    saveMessage.value = { type: 'error', text: t('settings.themeActivationError') };
  } finally {
    isSaving.value = false;
  }
};

const switchToCustom = async (themeName: string) => {
  if (currentTheme.value === themeName) return;
  isSaving.value = true;
  try {
    let newSettings = settingsService.getSettings();
    if (window.__TAURI__?.core) {
      const themeSettings = await window.__TAURI__.core.invoke('load_theme', { theme: themeName });
      if (themeSettings) {
        newSettings = { ...newSettings, ...themeSettings, theme: themeName };
      }
    }
    
    await settingsService.saveSettings({ ...newSettings, theme: themeName });
    currentTheme.value = themeName;
    saveMessage.value = { type: 'success', text: t('settings.themeActivatedWithName', { theme: themeName }) };
    setTimeout(() => { saveMessage.value = null; }, 2000);
  } catch (e) {
    console.error('Failed to switch theme:', e);
    saveMessage.value = { type: 'error', text: t('settings.themeActivationError') };
  } finally {
    isSaving.value = false;
  }
};

const saveCurrentAsTheme = async () => {
  const name = prompt(t('settings.enterThemeNamePrompt'));
  if (!name || !name.trim()) return;
  
  const cleanName = name.trim();
  isSaving.value = true;
  try {
    const currentSettings = settingsService.getSettings();
    const plainSettings = JSON.parse(JSON.stringify(currentSettings));
    plainSettings.theme = cleanName;
    
    if (window.__TAURI__?.core) {
      await window.__TAURI__.core.invoke('save_custom_theme', { name: cleanName, settings: plainSettings });
      await loadCustomThemes();
    }
    
    await settingsService.saveSettings(plainSettings);
    currentTheme.value = cleanName;
    
    saveMessage.value = { type: 'success', text: t('settings.themeSaved', { theme: cleanName }) };
    setTimeout(() => { saveMessage.value = null; }, 2000);
  } catch (e) {
    console.error('Failed to save custom theme:', e);
    saveMessage.value = { type: 'error', text: t('settings.themeSaveError') };
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.theme-switcher {
  padding: 20px;
  border-radius: var(--radius-card);
  background: var(--glass-panel);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border-color);
}

.theme-header {
  margin-bottom: 20px;
}

.theme-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-heading);
  margin-bottom: 4px;
}

.theme-description {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.theme-options {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.theme-option {
  flex: 1;
  min-width: 120px;
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-card);
  background: transparent;
  cursor: pointer;
  transition: all 0.3s var(--anim-ease);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
}

.theme-option:hover {
  border-color: var(--accent);
  background: rgba(139, 92, 246, 0.05);
  transform: translateY(-2px);
}

.theme-option.active {
  border-color: var(--accent);
  background: rgba(139, 92, 246, 0.1);
  box-shadow: 0 0 20px var(--accent-glow);
}

.theme-preview {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-btn);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-size: 28px;
}

.dark-preview {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.light-preview {
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.custom-preview {
  background: linear-gradient(135deg, var(--accent) 0%, var(--bg-panel) 100%);
  border: 1px solid var(--border-color);
}

.preview-bg {
  position: absolute;
  inset: 0;
  opacity: 0.3;
}

.preview-text {
  position: relative;
  z-index: 1;
}

.theme-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-main);
  text-align: center;
}

.theme-active {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.theme-saving,
.theme-message {
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  text-align: center;
  animation: fadeIn 0.3s var(--anim-ease);
}

.theme-saving {
  background: rgba(139, 92, 246, 0.1);
  color: var(--accent);
  border: 1px solid var(--accent-glow);
}

.theme-message.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.theme-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
