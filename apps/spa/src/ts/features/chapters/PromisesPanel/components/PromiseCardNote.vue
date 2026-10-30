<template>
  <div class="card-note-section">
    <div v-if="editingNoteId === itemId" class="note-edit-box">
      <textarea 
        :value="noteDraft" 
        placeholder="Заметка к обещанию..."
        class="note-textarea"
        rows="2"
        @input="$emit('update:noteDraft', ($event.target as HTMLTextAreaElement).value)"
        @keydown.enter.ctrl.prevent="$emit('save')"
        @keydown.esc.prevent="$emit('cancelEdit')"
      ></textarea>
      <div class="note-actions">
        <button class="btn-xs btn-primary" @click="$emit('save')">Сохранить</button>
        <button class="btn-xs btn-ghost" @click="$emit('cancelEdit')">Отмена</button>
      </div>
    </div>
    <div v-else-if="note" class="note-display" @click="$emit('startEdit')">
      <span class="note-icon">📝</span>
      <span class="note-text">{{ note }}</span>
    </div>
    <button 
      v-else 
      class="btn-add-note" 
      @click="$emit('startEdit')"
    >
      + Добавить заметку
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PromiseCardNoteProps, PromiseCardNoteEmits } from './PromiseCardNote.model';
defineProps<PromiseCardNoteProps>>();

defineEmits<PromiseCardNoteEmits>>();
</script>
