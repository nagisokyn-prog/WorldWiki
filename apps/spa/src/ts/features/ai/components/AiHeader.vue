<template>
  <div class="wowilon-header">
    <div class="header-left">
      <div class="wowilon-title">
        <i class="fas fa-robot"></i>
        <span class="title-text">WoWiLon AI</span>
      </div>
      
      <div class="mode-switcher">
        <button 
          :class="{ active: currentMode === 'chat' }" 
          title="Собеседник (Только чтение)"
          @click="setMode('chat')"
        >
          <i class="fas fa-comments"></i>
        </button>
        <button 
          :class="{ active: currentMode === 'edit' }" 
          title="Редактор (Чтение + Запись)"
          @click="setMode('edit')"
        >
          <i class="fas fa-edit"></i>
        </button>
        <button 
          :class="{ active: currentMode === 'analyze' }" 
          title="Аналитик (Сложные отчёты)"
          @click="setMode('analyze')"
        >
          <i class="fas fa-chart-line"></i>
        </button>
      </div>
    </div>

    <div class="wowilon-actions">
      <button class="action-btn" title="Настройки ИИ" @click="handleOpenSettings">
        <i class="fas fa-cog"></i>
      </button>
      
      <!-- Show detach only if we are not already detached -->
      <button v-if="!isDetached" class="action-btn" title="Открепить окно" @click="handleDetach">
        <i class="fas fa-external-link-alt"></i>
      </button>
      <button v-if="!isDetached" class="action-btn close-btn" title="Закрыть" @click="handleClose">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiHeaderProps, AiHeaderEmits } from './AiHeader.model';
import { useAiHeader } from './useAiHeader';

const props = withDefaults(defineProps<AiHeaderProps>(), {
  isDetached: false
});

const emit = defineEmits<AiHeaderEmits>();

const { currentMode, setMode, handleOpenSettings, handleDetach, handleClose } = useAiHeader(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiHeader.css"></style>
