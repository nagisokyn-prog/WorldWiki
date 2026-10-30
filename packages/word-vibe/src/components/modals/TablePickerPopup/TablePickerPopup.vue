<template>
  <Teleport to="body">
    <div v-if="isOpen" class="wmodal-overlay wmodal-overlay-transparent" @click.self="emit('close')">
      <div class="table-picker" role="dialog" aria-modal="true">
        <div class="table-picker-grid">
          <button
            v-for="r in rows"
            :key="`r${r}`"
            type="button"
            class="table-picker-row"
          >
            <span
              v-for="c in cols"
              :key="`c${c}`"
              class="table-picker-cell"
              :class="{ 'is-active': hover && r <= hover.rows && c <= hover.cols }"
              @mouseenter="hover = { rows: r, cols: c }"
              @click="insert(r, c)"
            ></span>
          </button>
        </div>
        <div class="table-picker-label">{{ label }}</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useTablePickerPopup } from './useTablePickerPopup';
import type { TablePickerPopupProps, TablePickerPopupEmits } from './TablePickerPopup.model';

const props = defineProps<TablePickerPopupProps>();
const emit = defineEmits<TablePickerPopupEmits>();
const { hover, rows, cols, label, insert } = useTablePickerPopup(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
