<template>
  <div class="ribbon-tab-content flex">
    <!-- Группа: Шрифт -->
    <RibbonFontGroup
      :current-font-family="currentFontFamily"
      :current-font-size="currentFontSize"
      :commands="commands"
      :call="call"
      @update:font-family="$emit('update:fontFamily', $event)"
      @update:font-size="$emit('update:fontSize', $event)"
      @step-font-size="$emit('stepFontSize', $event)"
      @open-font-dialog="$emit('open-font-dialog')"
    />

    <!-- Группа: Абзац -->
    <RibbonParagraphGroup
      :current-line-height="currentLineHeight"
      :show-invisibles="showInvisibles"
      :commands="commands"
      :call="call"
      @update:line-height="$emit('update:lineHeight', $event)"
      @toggle-invisibles="$emit('toggleInvisibles')"
      @open-paragraph-dialog="$emit('open-paragraph-dialog')"
    />

    <!-- Группа: Стили / Заголовки -->
    <div class="ribbon-group">
      <div class="ribbon-group-rows">
        <div class="ribbon-row">
          <button 
            type="button" 
            class="ribbon-btn" 
            title="Заголовок 1 (Ctrl+Alt+1)"
            @click="call('setHeading', () => commands.setHeading?.(1))"
          >
            H1
          </button>
          <button 
            type="button" 
            class="ribbon-btn" 
            title="Заголовок 2 (Ctrl+Alt+2)"
            @click="call('setHeading', () => commands.setHeading?.(2))"
          >
            H2
          </button>
          <button 
            type="button" 
            class="ribbon-btn" 
            title="Заголовок 3 (Ctrl+Alt+3)"
            @click="call('setHeading', () => commands.setHeading?.(3))"
          >
            H3
          </button>
        </div>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Стили</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonCommands } from '../../../ribbon/commands';
import RibbonFontGroup from '../groups/RibbonFontGroup.vue';
import RibbonParagraphGroup from '../groups/RibbonParagraphGroup.vue';

defineProps<{
  currentFontFamily: string;
  currentFontSize: string;
  currentLineHeight: string;
  showInvisibles: boolean;
  commands: Partial<RibbonCommands>;
  call: (name: string, fn?: () => void) => void;
}>();

defineEmits<{
  (e: 'update:fontFamily', val: string): void;
  (e: 'update:fontSize', val: string): void;
  (e: 'update:lineHeight', val: string): void;
  (e: 'stepFontSize', step: number): void;
  (e: 'toggleInvisibles'): void;
  (e: 'open-font-dialog'): void;
  (e: 'open-paragraph-dialog'): void;
}>();
</script>
