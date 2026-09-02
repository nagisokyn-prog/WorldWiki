<script setup lang="ts">
import { ref, watch } from 'vue';

/** Диалог вставки уравнения (LaTeX → MathBlock, замена prompt). */
const props = defineProps<{ isOpen: boolean }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'insert', payload: { latex: string }): void;
}>();

const latex = ref('f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx');

watch(
  () => props.isOpen,
  (open) => {
    if (open) latex.value = 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx';
  }
);

const handleInsert = () => {
  if (!latex.value.trim()) return;
  emit('insert', { latex: latex.value.trim() });
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="wmodal-overlay" @click.self="emit('close')">
      <div class="wmodal" role="dialog" aria-modal="true">
        <div class="wmodal-header">
          <h3>Уравнение (LaTeX)</h3>
          <button type="button" class="wmodal-close" @click="emit('close')">✕</button>
        </div>
        <div class="wmodal-body">
          <label class="wmodal-field wmodal-field-vertical">
            <span>Формула:</span>
            <textarea v-model="latex" rows="4" spellcheck="false"></textarea>
          </label>
        </div>
        <div class="wmodal-footer">
          <button type="button" class="wmodal-btn" @click="emit('close')">Отмена</button>
          <button type="button" class="wmodal-btn wmodal-btn-primary" @click="handleInsert">Вставить</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
