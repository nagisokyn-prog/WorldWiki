<template>
  <Teleport to="body">
    <div v-if="isOpen" class="wmodal-overlay" @click.self="emit('close')">
      <div class="wmodal wmodal-sm" role="dialog" aria-modal="true">
        <div class="wmodal-header">
          <h3>Колонтитулы</h3>
          <button type="button" class="wmodal-close" @click="emit('close')">✕</button>
        </div>

        <div class="wmodal-tabs">
          <button type="button" :class="{ 'is-active': activeTab === 'header' }" @click="activeTab = 'header'">Верхний</button>
          <button type="button" :class="{ 'is-active': activeTab === 'footer' }" @click="activeTab = 'footer'">Нижний</button>
        </div>

        <div class="wmodal-body">
          <template v-if="activeTab === 'header'">
            <label class="wmodal-field"><span>Слева:</span><input v-model="headerLeft" type="text" placeholder="Название главы" /></label>
            <label class="wmodal-field"><span>По центру:</span><input v-model="headerCenter" type="text" /></label>
            <label class="wmodal-field"><span>Справа:</span><input v-model="headerRight" type="text" /></label>
          </template>
          <template v-else>
            <label class="wmodal-field"><span>Слева:</span><input v-model="footerLeft" type="text" /></label>
            <label class="wmodal-field"><span>По центру:</span><input v-model="footerCenter" type="text" /></label>
            <label class="wmodal-field"><span>Справа:</span><input v-model="footerRight" type="text" placeholder="Стр. {page} из {total}" /></label>
          </template>
          <p class="wmodal-hint">Подсказки: <code>{page}</code> — номер страницы, <code>{total}</code> — всего страниц.</p>
        </div>

        <div class="wmodal-footer">
          <button type="button" class="wmodal-btn" @click="emit('close')">Отмена</button>
          <button type="button" class="wmodal-btn wmodal-btn-primary" @click="handleApply">ОК</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useHeaderFooterDialog } from './useHeaderFooterDialog';

const props = defineProps<{
  isOpen: boolean;
  initialTab?: 'header' | 'footer';
  header?: { left: string; center: string; right: string };
  footer?: { left: string; center: string; right: string };
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'apply', payload: { header: { left: string; center: string; right: string }; footer: { left: string; center: string; right: string } }): void }>();
const { activeTab, headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight, handleApply } =
  useHeaderFooterDialog(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordDialogs.css"></style>
