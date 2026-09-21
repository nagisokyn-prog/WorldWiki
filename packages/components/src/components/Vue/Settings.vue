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
                @save="save"
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
import SettingsNavRail from './Settings/SettingsNavRail.vue';
import { useSettings } from './useSettings';

defineEmits(['close', 'back']);

const {
  activeTab,
  settings,
  activeComponent,
  changeLocale,
  save,
  pickBackgroundFile,
  resetSettings
} = useSettings();

defineExpose({
  activeTab,
  settings,
  changeLocale,
  resetSettings
});
</script>

<style src="@worldwiki/resources/styles/components/Settings.css"></style>
