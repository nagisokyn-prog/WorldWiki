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
      <button class="action-btn" title="Настройки ИИ" @click="$emit('open-settings')">
        <i class="fas fa-cog"></i>
      </button>
      
      <!-- Show detach only if we are not already detached -->
      <button v-if="!isDetached" class="action-btn" title="Открепить окно" @click="$emit('detach')">
        <i class="fas fa-external-link-alt"></i>
      </button>
      <button v-if="!isDetached" class="action-btn close-btn" title="Закрыть" @click="$emit('close')">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(defineProps<{
  isDetached?: boolean;
}>(), {
  isDetached: false
});

defineEmits<{
  (e: 'close'): void;
  (e: 'detach'): void;
  (e: 'open-settings'): void;
}>();

const currentMode = ref('chat');

const setMode = (mode: string) => {
  currentMode.value = mode;
  // TODO: Trigger agent mode change
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiHeader.css"></style>
