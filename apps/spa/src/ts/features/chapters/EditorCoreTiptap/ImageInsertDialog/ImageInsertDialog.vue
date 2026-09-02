<script setup lang="ts">
import { ref, watch } from 'vue';

/**
 * Диалог загрузки рисунка (замена prompt): файл с компьютера → base64,
 * либо URL; необязательная подпись (ГОСТ «Рисунок N — ...»); выравнивание.
 */
const props = defineProps<{ isOpen: boolean }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'insert', payload: { src: string; caption: string; align: 'block' | 'left' | 'right' }): void;
}>();

const url = ref('');
const caption = ref('');
const align = ref<'block' | 'left' | 'right'>('block');
const fileInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      url.value = '';
      caption.value = '';
      align.value = 'block';
    }
  }
);

const pickFile = () => fileInput.value?.click();

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    url.value = String(reader.result);
  };
  reader.readAsDataURL(file);
  input.value = '';
};

const handleInsert = () => {
  if (!url.value.trim()) return;
  emit('insert', { src: url.value.trim(), caption: caption.value.trim(), align: align.value });
  emit('close');
};
</script>

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

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
