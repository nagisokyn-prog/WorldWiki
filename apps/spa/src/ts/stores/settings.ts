/**
 * @file settings.ts
 * @description Pinia store для settings (обёртка над settingsService)
 */
import { defineStore } from 'pinia';
import { computed } from 'vue';
import { settingsService } from '../services/settings.service';

export const useSettingsStore = defineStore('settings', () => {
  const settings = computed(() => settingsService.getSettings());
  
  const getSettings = () => settingsService.getSettings();
  const setSettings = (newSettings: any) => settingsService.saveSettings(newSettings);
  const loadSettings = async () => settingsService.loadSettings();
  const applySettings = () => settingsService.applySettings();

  return { settings, getSettings, setSettings, loadSettings, applySettings };
});