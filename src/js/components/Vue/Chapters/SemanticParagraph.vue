<template>
  <node-view-wrapper class="semantic-block">
    <div 
      class="semantic-tag-badge interactive-el" 
      contenteditable="false" 
      @click="cycleTag"
      :class="currentTag"
      :title="tagTitle"
    >
      {{ tagDisplay }}
    </div>
    <node-view-content class="semantic-content" />
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3';

const props = defineProps(nodeViewProps);

const tags = ['desc', 'dialog', 'thought'];
const tagLabels: Record<string, { label: string, title: string }> = {
  'desc': { label: '!о', title: 'Описание' },
  'dialog': { label: '!д', title: 'Диалог' },
  'thought': { label: '!м', title: 'Мысли' }
};

const currentTag = computed(() => props.node.attrs.semanticTag || 'desc');
const tagDisplay = computed(() => tagLabels[currentTag.value]?.label || '!о');
const tagTitle = computed(() => tagLabels[currentTag.value]?.title || 'Описание');

const cycleTag = () => {
  const currentIndex = tags.indexOf(currentTag.value);
  const nextIndex = (currentIndex + 1) % tags.length;
  const nextTag = tags[nextIndex];
  props.updateAttributes({ semanticTag: nextTag });
};
</script>

<style scoped>
.semantic-block {
  margin-bottom: 8px;
  position: relative;
}

.semantic-tag-badge {
  position: absolute;
  left: -42px;
  top: 2px;
  width: 30px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  background: var(--bg-panel, #1a1a2e);
  border: 1px solid var(--border-color, #333);
  color: var(--text-muted, #888);
}

.semantic-tag-badge.desc {
  color: #94a3b8;
}

.semantic-tag-badge.dialog {
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.05);
}

.semantic-tag-badge.thought {
  color: #c084fc;
  border-color: rgba(192, 132, 252, 0.3);
  background: rgba(192, 132, 252, 0.05);
}

.semantic-tag-badge:hover {
  filter: brightness(1.2);
  transform: scale(1.05);
}

.semantic-content {
  flex: 1;
  min-width: 0;
}

/* Fix tiptap styling for node-view-content so it behaves like a normal paragraph */
:deep(.semantic-content p) {
  margin: 0;
  padding: 0;
}
</style>
