<template>
  <div class="message-actions-hover">
    <button class="icon-btn" title="Копировать текст" @click="$emit('copy')">
      <i class="fas fa-copy"></i>
    </button>
    <button 
      v-if="role === 'user'" 
      class="icon-btn" 
      title="Редактировать сообщение" 
      @click="$emit('start-edit')"
    >
      <i class="fas fa-pencil-alt"></i>
    </button>
    <button 
      v-if="role === 'assistant'" 
      class="icon-btn" 
      title="Перегенерировать ответ" 
      @click="$emit('regenerate')"
    >
      <i class="fas fa-sync-alt"></i>
    </button>
    <button class="icon-btn" title="Создать ветку отсюда (Fork)" @click="$emit('branch')">
      <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="13" width="13" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
        <path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
        <path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
        <path d="M7 8l0 8"></path>
        <path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path>
        <path d="M14 14l3 -3l3 3"></path>
      </svg>
    </button>
    <button class="icon-btn danger" title="Удалить сообщение" @click="$emit('delete')">
      <i class="fas fa-trash-alt"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AiMessageActionsBarProps, AiMessageActionsBarEmits } from './AiMessageActionsBar.model';
defineProps<AiMessageActionsBarProps>();

defineEmits<AiMessageActionsBarEmits>();
</script>
