<template>
  <Teleport to="body">
    <div v-if="isOpen" class="wmodal-overlay" @click.self="emit('close')">
      <div class="wmodal wmodal-sm" role="dialog" aria-modal="true">
        <div class="wmodal-header">
          <h3>Вставить ссылку</h3>
          <button type="button" class="wmodal-close" @click="emit('close')">✕</button>
        </div>
        <div class="wmodal-body">
          <label class="wmodal-field"><span>Адрес:</span><input v-model="url" type="text" /></label>
          <label class="wmodal-field"><span>Текст (необязательно):</span><input v-model="text" type="text" /></label>
        </div>
        <div class="wmodal-footer">
          <button type="button" class="wmodal-btn" @click="emit('close')">Отмена</button>
          <button type="button" class="wmodal-btn wmodal-btn-primary" @click="handleInsert">ОК</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useLinkInsertDialog } from './useLinkInsertDialog';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'insert', payload: { url: string; text: string }): void }>();
const { url, text, handleInsert } = useLinkInsertDialog(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
