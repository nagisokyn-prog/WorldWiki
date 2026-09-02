<script setup lang="ts">
import { computed, ref } from 'vue';

/**
 * Hover-grid пикер таблицы (как в Word): сетка 8×10, подпись «Таблица 3×4».
 */
const MAX_ROWS = 8;
const MAX_COLS = 10;

defineProps<{ isOpen: boolean }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'insert', payload: { rows: number; cols: number }): void;
}>();

const hover = ref<{ rows: number; cols: number } | null>(null);

const rows = computed(() => Array.from({ length: MAX_ROWS }, (_, i) => i + 1));
const cols = computed(() => Array.from({ length: MAX_COLS }, (_, i) => i + 1));

const label = computed(() => {
  if (!hover.value) return 'Таблица';
  return `Таблица ${hover.value.rows}×${hover.value.cols}`;
});

const insert = (r: number, c: number) => {
  emit('insert', { rows: r, cols: c });
  emit('close');
};
</script>

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

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
