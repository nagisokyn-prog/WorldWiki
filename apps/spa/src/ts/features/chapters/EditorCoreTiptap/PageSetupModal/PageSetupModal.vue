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

<script setup lang="ts">
import { usePageSetupModal } from './usePageSetupModal';

const props = defineProps<{
  isOpen: boolean;
  margins?: { top: number; bottom: number; left: number; right: number };
  pageSize?: import('@worldwiki/word-vibe').PageSize;
  orientation?: import('@worldwiki/word-vibe').Orientation;
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'apply', payload: { margins: { top: number; bottom: number; left: number; right: number }; pageSize: import('@worldwiki/word-vibe').PageSize; orientation: import('@worldwiki/word-vibe').Orientation }): void }>();
const { activeTab, topMm, bottomMm, leftMm, rightMm, size, orient, applyGost, handleApply, SIZES } =
  usePageSetupModal(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
