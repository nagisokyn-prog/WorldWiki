<template>
  <div ref="containerRef" class="ai-mode-selector">
    <button 
      class="mode-trigger-btn" 
      :class="{ 'is-open': isOpen }"
      :title="currentMode.name + ' (' + (currentMode.hotkey || 'Ctrl + .') + ')'"
      @click="togglePopover"
    >
      <i :class="[currentMode.icon, 'mode-icon']"></i>
      <span class="mode-label">{{ currentMode.name }}</span>
      <i class="fas fa-chevron-down chevron-icon"></i>
    </button>

    <div v-if="isOpen" class="mode-popover" :class="{ 'open-down': placement === 'bottom' }">
      <div class="popover-header">
        Специализированные персоны WoWiLon AI. Ctrl + . для следующего режима
      </div>

      <div class="popover-list">
        <div 
          v-for="mode in personaModes" 
          :key="mode.slug"
          class="mode-card"
          :class="{ 'is-active': mode.slug === activeNormalizedSlug }"
          @click="selectMode(mode.slug)"
        >
          <div class="mode-card-left">
            <i :class="[mode.icon, 'mode-card-icon']"></i>
            <div class="mode-card-info">
              <span class="mode-card-title">{{ mode.name }}</span>
              <span class="mode-card-desc">{{ mode.description }}</span>
            </div>
          </div>
          <div class="mode-card-right">
            <i v-if="mode.slug === activeNormalizedSlug" class="fas fa-check"></i>
          </div>
        </div>
      </div>

      <div class="popover-footer">
        <button class="settings-btn" @click="openSettings">
          <i class="fas fa-cog"></i>
          <span>Настройки режимов</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiModeSelectorProps, AiModeSelectorEmits } from './AiModeSelector.model';
import { useAiModeSelector } from './useAiModeSelector';

const props = defineProps<AiModeSelectorProps>();
const emit = defineEmits<AiModeSelectorEmits>();

const {
  isOpen,
  containerRef,
  personaModes,
  activeNormalizedSlug,
  currentMode,
  togglePopover,
  selectMode,
  openSettings
} = useAiModeSelector(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiModeSelector.css"></style>
