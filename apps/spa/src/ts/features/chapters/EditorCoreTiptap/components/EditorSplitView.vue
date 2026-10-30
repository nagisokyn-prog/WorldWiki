<template>
  <div class="split-editor-box">
    <!-- Left: Markdown Editor -->
    <div :style="{ '--split-left': leftPanelWidth + '%' }" class="split-left-panel flex-col overflow-hidden border-r">
      <div class="split-panel-header">✏️ Markdown</div>
      <textarea 
        ref="textareaRef"
        :value="markdownContent" 
        placeholder="# Напишите markdown..."
        class="markdown-editor-textarea split"
        @input="emit('update:markdownContent', ($event.target as HTMLTextAreaElement).value); emit('input', $event)"
        @keydown.exact="emit('keydown', $event)"
        @keydown.exact.ctrl.meta.shift.q.prevent="emit('open-entity-selector')"
        @keydown.exact.ctrl.meta.prevent.enter="emit('open-entity-selector')"
        @contextmenu="emit('contextmenu', $event)"
      ></textarea>
    </div>

    <!-- Drag Handle Left -->
    <div 
      class="drag-handle-col"
      title="Потащите для изменения ширины"
      @mousedown="emit('start-resize-left', $event)"
    ></div>

    <!-- Middle: WYSIWYG Preview -->
    <div 
      :style="{ '--split-right': rightPanelWidth + '%' }" 
      class="split-middle-panel flex-col overflow-hidden" 
      :class="{ 'border-r': showStructure, 'is-full-width': !showStructure }"
    >
      <div class="split-panel-header">👁️ Preview</div>
      <div class="flex-1 overflow-auto relative">
        <EditorContent :editor="editor" class="editor-content-split" />
      </div>
    </div>

    <!-- Drag Handle Right -->
    <div 
      v-if="showStructure"
      class="drag-handle-col"
      title="Потащите для изменения ширины"
      @mousedown="emit('start-resize-right', $event)"
    ></div>

    <!-- Right: Block Structure -->
    <div v-if="showStructure" class="flex-1 flex-col overflow-hidden bg-input">
      <div class="split-panel-header split-panel-header-structure">🧩 Структура (Ctrl+R)</div>
      <div class="flex-1 overflow-y-auto p-2 border-l">
        <div 
          v-for="(block, idx) in documentStructure" 
          :key="idx" 
          class="structure-block-item" 
          :class="{ 'block-selected': selectedBlockIdx === idx }" 
          @click="emit('scroll-to-block', idx)"
        >
          <div 
            v-if="block.semanticTag" 
            class="interactive-el semantic-badge" 
            :class="block.semanticTag === 'desc' ? 'desc' : block.semanticTag === 'dialog' ? 'dialog' : 'other'" 
            @click.stop="emit('cycle-tag', block.pIndex!)"
          >
            {{ block.semanticTag === 'desc' ? '!о' : block.semanticTag === 'dialog' ? '!д' : '!м' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-accent mb-1 text-xs">{{ block.type }}</div>
            <div class="text-muted text-xs truncate">{{ block.text }}</div>
          </div>
        </div>
        <div v-if="documentStructure.length === 0" class="text-muted text-xs p-3 text-center">Нет блоков</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorSplitViewProps, EditorSplitViewEmits } from './EditorSplitView.model';
import { ref } from 'vue';
import { EditorContent, type Editor } from '@tiptap/vue-3';

defineProps<EditorSplitViewProps>();

const emit = defineEmits<EditorSplitViewEmits>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

defineExpose({
  textareaRef
});
</script>
