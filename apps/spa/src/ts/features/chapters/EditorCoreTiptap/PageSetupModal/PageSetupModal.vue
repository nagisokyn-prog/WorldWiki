<script setup lang="ts">
import { ref, watch } from 'vue';
import type { PageSize, Orientation } from '../WordMode/RkWordEditor.model';
import type { MarginsMm } from '../WordMode/useRkWordEditor';

/**
 * Диалог «Параметры страницы» (как в Word): 3 вкладки — Поля / Бумага / Макет.
 */
const props = defineProps<{
  isOpen: boolean;
  margins?: MarginsMm;
  pageSize?: PageSize;
  orientation?: Orientation;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply', payload: { margins: MarginsMm; pageSize: PageSize; orientation: Orientation }): void;
}>();

const activeTab = ref<'margins' | 'paper' | 'layout'>('margins');

const topMm = ref(20);
const bottomMm = ref(20);
const leftMm = ref(30);
const rightMm = ref(15);
const size = ref<PageSize>('A4');
const orient = ref<Orientation>('portrait');

const SIZES: Array<{ value: PageSize; label: string }> = [
  { value: 'A4', label: 'A4 (210 × 297 мм)' },
  { value: 'A5', label: 'A5 (148 × 210 мм)' },
  { value: 'A3', label: 'A3 (297 × 420 мм)' },
  { value: 'Letter', label: 'Letter (216 × 279 мм)' },
  { value: 'B5', label: 'B5 (176 × 250 мм)' },
];

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      topMm.value = props.margins?.top ?? 20;
      bottomMm.value = props.margins?.bottom ?? 20;
      leftMm.value = props.margins?.left ?? 30;
      rightMm.value = props.margins?.right ?? 15;
      size.value = props.pageSize || 'A4';
      orient.value = props.orientation || 'portrait';
      activeTab.value = 'margins';
    }
  }
);

const applyGost = () => {
  topMm.value = 20;
  bottomMm.value = 20;
  leftMm.value = 30;
  rightMm.value = 15;
};

const handleApply = () => {
  emit('apply', {
    margins: { top: topMm.value, bottom: bottomMm.value, left: leftMm.value, right: rightMm.value },
    pageSize: size.value,
    orientation: orient.value,
  });
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="wmodal-overlay" @click.self="emit('close')">
      <div class="wmodal" role="dialog" aria-modal="true">
        <div class="wmodal-header">
          <h3>Параметры страницы</h3>
          <button type="button" class="wmodal-close" @click="emit('close')">✕</button>
        </div>

        <div class="wmodal-tabs">
          <button type="button" :class="{ 'is-active': activeTab === 'margins' }" @click="activeTab = 'margins'">Поля</button>
          <button type="button" :class="{ 'is-active': activeTab === 'paper' }" @click="activeTab = 'paper'">Бумага</button>
          <button type="button" :class="{ 'is-active': activeTab === 'layout' }" @click="activeTab = 'layout'">Макет</button>
        </div>

        <div class="wmodal-body">
          <template v-if="activeTab === 'margins'">
            <label class="wmodal-field"><span>Верхнее (мм):</span><input v-model.number="topMm" type="number" min="0" max="100" /></label>
            <label class="wmodal-field"><span>Нижнее (мм):</span><input v-model.number="bottomMm" type="number" min="0" max="100" /></label>
            <label class="wmodal-field"><span>Левое (мм):</span><input v-model.number="leftMm" type="number" min="0" max="100" /></label>
            <label class="wmodal-field"><span>Правое (мм):</span><input v-model.number="rightMm" type="number" min="0" max="100" /></label>
            <button type="button" class="wmodal-btn" @click="applyGost">ГОСТ 7.32 (Л:30 П:15 В:20 Н:20)</button>
          </template>

          <template v-else-if="activeTab === 'paper'">
            <label class="wmodal-field">
              <span>Размер:</span>
              <select v-model="size" class="wmodal-select">
                <option v-for="s in SIZES" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </label>
            <div class="wmodal-field">
              <span>Ориентация:</span>
              <label class="wmodal-radio"><input v-model="orient" type="radio" value="portrait" /> Книжная</label>
              <label class="wmodal-radio"><input v-model="orient" type="radio" value="landscape" /> Альбомная</label>
            </div>
          </template>

          <template v-else>
            <p class="wmodal-hint">
              Расстояние колонтитулов от края и особые колонтитулы (первая страница,
              чётные/нечётные) настраиваются в диалоге «Колонтитулы» на вкладке «Вставка».
            </p>
          </template>
        </div>

        <div class="wmodal-footer">
          <button type="button" class="wmodal-btn" @click="applyGost">По умолчанию</button>
          <button type="button" class="wmodal-btn" @click="emit('close')">Отмена</button>
          <button type="button" class="wmodal-btn wmodal-btn-primary" @click="handleApply">ОК</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
