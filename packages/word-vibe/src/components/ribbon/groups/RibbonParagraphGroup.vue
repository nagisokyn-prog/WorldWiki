<template>
  <div class="ribbon-group">
    <div class="ribbon-group-rows">
      <!-- Верхний ряд: Списки, Отступы, Пилькроу -->
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Маркеры (список)"
          @click="call('toggleBulletList', commands.toggleBulletList)"
        >
          <i class="fas fa-list-ul"></i>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Нумерация"
          @click="call('toggleOrderedList', commands.toggleOrderedList)"
        >
          <i class="fas fa-list-ol"></i>
        </button>

        <span class="ribbon-separator"></span>

        <button 
          type="button" 
          class="ribbon-btn" 
          title="Уменьшить отступ"
          @click="commands.decreaseIndent?.()"
        >
          <i class="fas fa-outdent"></i>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="Увеличить отступ"
          @click="commands.increaseIndent?.()"
        >
          <i class="fas fa-indent"></i>
        </button>

        <span class="ribbon-separator"></span>

        <button 
          type="button" 
          class="ribbon-btn" 
          :class="{ 'is-active': showInvisibles }" 
          title="Отобразить все знаки (¶)"
          @click="$emit('toggleInvisibles')"
        >
          ¶
        </button>
      </div>

      <!-- Нижний ряд: Выравнивание, Межстрочный интервал -->
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn" 
          title="По левому краю (Ctrl+L)"
          @click="call('setTextAlign', () => commands.setTextAlign?.('left'))"
        >
          <i class="fas fa-align-left"></i>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="По центру (Ctrl+E)"
          @click="call('setTextAlign', () => commands.setTextAlign?.('center'))"
        >
          <i class="fas fa-align-center"></i>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="По правому краю (Ctrl+R)"
          @click="commands.setTextAlign?.('right')"
        >
          <i class="fas fa-align-right"></i>
        </button>
        <button 
          type="button" 
          class="ribbon-btn" 
          title="По ширине (Ctrl+J)"
          @click="commands.setTextAlign?.('justify')"
        >
          <i class="fas fa-align-justify"></i>
        </button>

        <span class="ribbon-separator"></span>

        <select 
          :value="currentLineHeight" 
          class="ribbon-select" 
          title="Междустрочный интервал"
          @change="$emit('update:lineHeight', ($event.target as HTMLSelectElement).value)"
        >
          <option value="1.0">1,0</option>
          <option value="1.15">1,15</option>
          <option value="1.5">1,5 (ГОСТ)</option>
          <option value="2.0">2,0</option>
        </select>

        <button 
          type="button" 
          class="ribbon-btn" 
          title="Цитата"
          @click="call('toggleBlockquote', commands.toggleBlockquote)"
        >
          <i class="fas fa-quote-right"></i>
        </button>
      </div>
    </div>

    <div class="ribbon-group-footer">
      <span class="ribbon-group-label">Абзац</span>
      <button 
        type="button" 
        class="ribbon-dialog-launcher" 
        title="Параметры абзаца"
        @click="$emit('open-paragraph-dialog')"
      >
        <i class="fas fa-external-link-alt"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonParagraphGroupProps, RibbonParagraphGroupEmits } from './RibbonParagraphGroup.model';

defineProps<RibbonParagraphGroupProps>();
defineEmits<RibbonParagraphGroupEmits>();
</script>
