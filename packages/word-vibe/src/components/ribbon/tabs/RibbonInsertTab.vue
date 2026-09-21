<template>
  <div class="ribbon-tab-content flex">
    <!-- Страницы -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Разрыв страницы (Ctrl+Enter)"
          @click="commands.insertPageBreak?.()"
        >
          <i class="fas fa-file-alt"></i>
          <span>Разрыв страницы</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Страницы</span>
      </div>
    </div>

    <!-- Колонтитулы -->
    <RibbonHeaderFooterGroup
      :open-dropdown="openDropdown"
      :dropdown-pos="dropdownPos"
      :commands="commands"
      @toggle-dropdown="(evt, name) => $emit('toggleDropdown', evt, name)"
      @close-dropdown="$emit('closeDropdown')"
      @apply-header-preset="$emit('applyHeaderPreset', $event)"
      @apply-footer-preset="$emit('applyFooterPreset', $event)"
      @apply-page-number-position="$emit('applyPageNumberPosition', $event)"
    />

    <!-- Текст: оглавление и текстовый блок -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button type="button" class="ribbon-btn ribbon-btn-large" title="Вставить оглавление (Содержание)" @click="commands.insertTableOfContents?.()">
          <i class="fas fa-list-ol"></i>
          <span>Оглавление</span>
        </button>
        <button type="button" class="ribbon-btn ribbon-btn-large" title="Вставить текстовый блок" @click="commands.insertTextBox?.()">
          <i class="fas fa-text-width"></i>
          <span>Текстовый блок</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Текст</span>
      </div>
    </div>

    <!-- Таблицы -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Вставить таблицу"
          @click="commands.insertTable?.()"
        >
          <i class="fas fa-table"></i>
          <span>Таблица</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Таблицы</span>
      </div>
    </div>

    <!-- Иллюстрации -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Вставить рисунок по ГОСТ"
          @click="commands.insertImage?.()"
        >
          <i class="fas fa-image"></i>
          <span>Рисунок</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Иллюстрации</span>
      </div>
    </div>

    <!-- Ссылки и сноски -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Гиперссылка (Ctrl+K)"
          @click="commands.insertLink?.()"
        >
          <i class="fas fa-link"></i>
          <span>Ссылка</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Подстрочная сноска (Ctrl+Alt+F)"
          @click="commands.insertFootnote?.()"
        >
          <i class="fas fa-asterisk"></i>
          <span>Сноска</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Ссылки и примечания</span>
      </div>
    </div>

    <!-- Символы и формулы -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Вставить математическое уравнение (Alt + =)"
          @click="commands.insertEquation?.()"
        >
          <i class="fas fa-square-root-alt"></i>
          <span>Уравнение (Alt+=)</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Символы</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonCommands } from '../../../ribbon/commands';
import RibbonHeaderFooterGroup from '../groups/RibbonHeaderFooterGroup.vue';

defineProps<{
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  commands: Partial<RibbonCommands>;
}>();

defineEmits<{
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'closeDropdown'): void;
  (e: 'applyHeaderPreset', preset: 'empty' | 'chapter-left' | 'chapter-center'): void;
  (e: 'applyFooterPreset', preset: 'empty' | 'page-right' | 'page-center' | 'page-only-right'): void;
  (e: 'applyPageNumberPosition', pos: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right'): void;
}>();
</script>
