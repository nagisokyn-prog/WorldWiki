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
      <button class="glass-btn save-theme-btn" @click="saveCurrentAsTheme">
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
import { useThemeSwitcher } from './useThemeSwitcher';

const {
  t,
  currentTheme,
  isSaving,
  saveMessage,
  customThemes,
  switchToDark,
  switchToLight,
  switchToCustom,
  saveCurrentAsTheme
} = useThemeSwitcher();
</script>

<style scoped src="@worldwiki/resources/styles/components/ThemeSwitcher.css"></style>
