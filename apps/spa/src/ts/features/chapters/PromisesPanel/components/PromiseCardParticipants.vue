<template>
  <div class="meta-row flex flex-col gap-1 relative">
    <div class="flex items-center justify-between text-xs text-muted">
      <span class="flex items-center gap-1">
        <span>👥</span>
        <span>Участники:</span>
      </span>
    </div>

    <div 
      class="tags-input-container"
      @click="$emit('open-dropdown')"
    >
      <div
        v-for="pid in currentParticipants"
        :key="pid"
        class="tag-pill"
      >
        <span>👤</span>
        <span class="font-medium">{{ getParticipantDisplayName(pid) }}</span>
        <button
          type="button"
          class="tag-remove"
          title="Удалить участника"
          @mousedown.stop
          @click.stop="handleRemove(pid, $event)"
        >
          ✕
        </button>
      </div>

      <input
        :value="participantInputQuery"
        type="text"
        class="tags-input"
        :placeholder="currentParticipants.length === 0 ? 'Имя персонажа (Enter)...' : '+ ещё...'"
        @focus="$emit('open-dropdown')"
        @input="$emit('update:participantInputQuery', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('add-participant', participantInputQuery)"
        @keydown.backspace="$emit('backspace')"
        @keydown.esc="$emit('close-dropdown')"
      />
    </div>

    <!-- Выпадающий список персонажей для быстрого выбора с солидным непрозрачным фоном -->
    <div 
      v-if="isParticipantDropdownOpen" 
      class="character-dropdown shadow-dropdown"
    >
      <div class="flex items-center justify-between px-2 py-1 border-b border-subtle text-xs text-muted">
        <span>Выберите персонажа:</span>
        <button type="button" class="btn-ghost-xs text-muted hover:text-main" @click.stop="$emit('close-dropdown')">✕ Скрыть</button>
      </div>

      <div
        v-for="char in availableCharacters"
        :key="char.id"
        class="char-option interactive-el"
        @mousedown.prevent="$emit('add-participant', char.name)"
      >
        <span class="text-accent text-xs">👤</span>
        <span class="font-medium flex-1 text-main">{{ char.name }}</span>
        <span class="text-xs text-muted">персонаж</span>
      </div>

      <div
        v-if="participantInputQuery.trim() && !availableCharacters.some(c => c.name.toLowerCase() === participantInputQuery.trim().toLowerCase())"
        class="char-option create-custom-option interactive-el"
        @mousedown.prevent="$emit('add-participant', participantInputQuery)"
      >
        <span>＋</span>
        <span>Добавить «{{ participantInputQuery.trim() }}»</span>
      </div>
      
      <div v-if="availableCharacters.length === 0 && !participantInputQuery.trim()" class="p-2 text-xs text-muted text-center">
        Все персонажи добавлены
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromiseCardParticipantsProps, PromiseCardParticipantsEmits } from './PromiseCardParticipants.model';
import type { ProjectEntityOption } from './PromiseCardMeta.model';
import { usePromiseCardParticipants } from './usePromiseCardParticipants';

defineProps<PromiseCardParticipantsProps>();
const emit = defineEmits<PromiseCardParticipantsEmits>();

const { handleRemove } = usePromiseCardParticipants(emit);
</script>
