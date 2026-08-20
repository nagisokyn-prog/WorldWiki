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
      <button class="glass-btn" style="width: 100%; margin-bottom: 16px; border-radius: 8px; padding: 10px;" @click="saveCurrentAsTheme">
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
import { settingsService } from '../../ts/services/settings.service';

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
    await settingsService.switchTheme('dark');
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
    await settingsService.switchTheme('light');
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

<style scoped src="@worldwiki/resources/styles/components/ThemeSwitcher.css"></style>
