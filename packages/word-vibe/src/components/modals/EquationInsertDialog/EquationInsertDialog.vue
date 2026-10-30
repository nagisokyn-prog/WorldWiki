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

<script setup lang="ts">
import { useEquationInsertDialog } from './useEquationInsertDialog';
import type { EquationInsertDialogProps, EquationInsertDialogEmits } from './EquationInsertDialog.model';

const props = defineProps<EquationInsertDialogProps>();
const emit = defineEmits<EquationInsertDialogEmits>();
const { latex, handleInsert } = useEquationInsertDialog(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
