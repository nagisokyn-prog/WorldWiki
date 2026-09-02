<template>
  <Teleport to="body">
    <div v-if="isOpen" class="wmodal-overlay" @click.self="emit('close')">
      <div class="wmodal" role="dialog" aria-modal="true">
        <div class="wmodal-header">
          <h3>Вставить рисунок</h3>
          <button type="button" class="wmodal-close" @click="emit('close')">✕</button>
        </div>

        <div class="wmodal-body">
          <button type="button" class="wmodal-btn" @click="pickFile">📂 Загрузить с компьютера...</button>
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFileChange" />

          <div class="wmodal-divider">── или ──</div>

          <label class="wmodal-field"><span>URL:</span><input v-model="url" type="text" placeholder="https://..." /></label>

          <label class="wmodal-field"><span>Подпись (необязательно):</span><input v-model="caption" type="text" placeholder="Рисунок N — ..." /></label>

          <div class="wmodal-field">
            <span>Выравнивание:</span>
            <label class="wmodal-radio"><input v-model="align" type="radio" value="block" /> По ширине</label>
            <label class="wmodal-radio"><input v-model="align" type="radio" value="left" /> Слева</label>
            <label class="wmodal-radio"><input v-model="align" type="radio" value="right" /> Справа</label>
          </div>
        </div>

        <div class="wmodal-footer">
          <button type="button" class="wmodal-btn" @click="emit('close')">Отмена</button>
          <button type="button" class="wmodal-btn wmodal-btn-primary" :disabled="!url.trim()" @click="handleInsert">Вставить</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { useImageInsertDialog } from './useImageInsertDialog';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'insert', payload: { src: string; caption: string; align: 'block' | 'left' | 'right' }): void }>();
const { url, caption, align, fileInput, pickFile, onFileChange, handleInsert } =
  useImageInsertDialog(props, emit);
</script>
<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
