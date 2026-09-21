<template>
  <div class="ribbon-group">
    <div class="ribbon-group-rows">
      <!-- Верхний ряд: Гарнитура, Кегль, Размер+/-, Очистка -->
      <div class="ribbon-row">
        <select 
          :value="currentFontFamily" 
          class="ribbon-select ribbon-select-font" 
          title="Шрифт (гарнитура)"
          @change="$emit('update:fontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <optgroup label="ГОСТ и Академические стандарты">
            <option value="'Times New Roman', Times, serif">Times New Roman (ГОСТ 7.32)</option>
            <option value="'PT Serif', Georgia, serif">PT Serif (Российский академический)</option>
            <option value="'PT Astra Serif', 'Times New Roman', serif">PT Astra Serif (Госслужба ГОСТ)</option>
            <option value="'PT Astra Sans', Arial, sans-serif">PT Astra Sans (Госслужба)</option>
            <option value="'Liberation Serif', Times, serif">Liberation Serif (Академический)</option>
          </optgroup>
          <optgroup label="Офисные стандарты">
            <option value="Calibri, sans-serif">Calibri (MS Word)</option>
            <option value="Arial, sans-serif">Arial (ГОСТ / Отчеты)</option>
            <option value="Georgia, serif">Georgia (Повышенная читаемость)</option>
          </optgroup>
          <optgroup label="Книжная и художественная верстка">
            <option value="'EB Garamond', Garamond, serif">EB Garamond (Классическая литература)</option>
            <option value="'Bookman Old Style', Georgia, serif">Bookman Old Style (Книжная печать)</option>
            <option value="'Century Schoolbook', Georgia, serif">Century Schoolbook (Учебники)</option>
            <option value="'Courier New', monospace">Courier New (Моноширинный / Сценарии)</option>
          </optgroup>
        </select>

        <select 
          :value="currentFontSize" 
          class="ribbon-select ribbon-select-size" 
          title="Размер шрифта"
          @change="$emit('update:fontSize', ($event.target as HTMLSelectElement).value)"
        >
          <option value="10pt">10</option>
          <option value="11pt">11</option>
          <option value="12pt">12</option>
          <option value="14pt">14</option>
          <option value="16pt">16</option>
          <option value="18pt">18</option>
          <option value="20pt">20</option>
          <option value="24pt">24</option>
        </select>

        <button 
          type="button" 
          class="ribbon-btn" 
          title="Увеличить размер (Ctrl+Shift+>)"
          @click="$emit('stepFontSize', 1)"
        >
          A<sup>▲</sup>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Уменьшить размер (Ctrl+Shift+<)"
          @click="$emit('stepFontSize', -1)"
        >
          A<sub>▼</sub>
        </button>

        <span class="ribbon-separator"></span>

        <button 
          type="button" 
          class="ribbon-btn" 
          title="Очистить всё форматирование"
          @click="call('clearFormatting', commands.clearFormatting)"
        >
          <i class="fas fa-eraser"></i>
        </button>
      </div>

      <!-- Нижний ряд: Ж, К, Ч, Зачеркнутый, Индексы, Цвет -->
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Полужирный (Ctrl+B)"
          @click="call('toggleBold', commands.toggleBold)"
        >
          <b>Ж</b>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Курсив (Ctrl+I)"
          @click="call('toggleItalic', commands.toggleItalic)"
        >
          <i>К</i>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Подчеркнутый (Ctrl+U)"
          @click="call('toggleUnderline', commands.toggleUnderline)"
        >
          <u class="ribbon-icon-underline">Ч</u>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Зачеркнутый"
          @click="call('toggleStrike', commands.toggleStrike)"
        >
          <s>ab</s>
        </button>

        <span class="ribbon-separator"></span>

        <button 
          type="button" 
          class="ribbon-btn" 
          title="Подстрочный знак (Ctrl+=)"
          @click="call('toggleSubscript', commands.toggleSubscript)"
        >
          x<sub>2</sub>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Надстрочный знак (Ctrl+Shift++)"
          @click="call('toggleSuperscript', commands.toggleSuperscript)"
        >
          x<sup>2</sup>
        </button>

        <span class="ribbon-separator"></span>

        <button 
          type="button" 
          class="ribbon-btn" 
          title="Цвет выделения текста (маркер)"
          @click="call('toggleHighlight', commands.toggleHighlight)"
        >
          <i class="fas fa-highlighter"></i>
        </button>
      </div>
    </div>

    <div class="ribbon-group-footer">
      <span class="ribbon-group-label">Шрифт</span>
      <button 
        type="button" 
        class="ribbon-dialog-launcher" 
        title="Параметры шрифта"
        @click="$emit('open-font-dialog')"
      >
        <i class="fas fa-external-link-alt"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonCommands } from '../../../ribbon/commands';

defineProps<{
  currentFontFamily: string;
  currentFontSize: string;
  commands: Partial<RibbonCommands>;
  call: (name: string, fn?: () => void) => void;
}>();

defineEmits<{
  (e: 'update:fontFamily', val: string): void;
  (e: 'update:fontSize', val: string): void;
  (e: 'stepFontSize', step: number): void;
  (e: 'open-font-dialog'): void;
}>();
</script>
