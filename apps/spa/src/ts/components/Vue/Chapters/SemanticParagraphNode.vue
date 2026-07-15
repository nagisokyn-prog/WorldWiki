<template>
  <node-view-wrapper class="semantic-paragraph-node" :class="node.attrs.semanticTag || 'desc'" style="position: relative; padding-left: 24px; min-height: 24px;">
    
    <!-- Tag Badge -->
    <div 
      contenteditable="false" 
      class="semantic-tag-badge interactive-el" 
      :title="tagTooltip"
      @click="cycleTag"
      :style="badgeStyle"
    >
      {{ tagLabel }}
    </div>

    <!-- Content (Paragraph Text) -->
    <node-view-content class="content-wrapper" />
    
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3';

const props = defineProps({
  ...nodeViewProps
});

const tagLabel = computed(() => {
  const tag = props.node?.attrs?.semanticTag || 'desc';
  if (tag === 'desc') return '!о';
  if (tag === 'dialog') return '!д';
  if (tag === 'thought') return '!м';
  return '!о';
});

const tagTooltip = computed(() => {
  const tag = props.node?.attrs?.semanticTag || 'desc';
  if (tag === 'desc') return 'Описание (клик для смены)';
  if (tag === 'dialog') return 'Диалог (клик для смены)';
  if (tag === 'thought') return 'Мысль (клик для смены)';
  return 'Тег';
});

const badgeStyle = computed(() => {
  const tag = props.node?.attrs?.semanticTag || 'desc';
  let bg = 'rgba(148, 163, 184, 0.1)';
  let color = '#94a3b8';
  
  if (tag === 'dialog') {
    bg = 'rgba(56, 189, 248, 0.1)';
    color = '#38bdf8';
  } else if (tag === 'thought') {
    bg = 'rgba(192, 132, 252, 0.1)';
    color = '#c084fc';
  }
  
  return {
    background: bg,
    color: color,
    position: 'absolute' as const,
    left: '0',
    top: '2px',
    fontWeight: '800',
    fontSize: '9px',
    padding: '2px 4px',
    borderRadius: '3px',
    cursor: 'pointer',
    userSelect: 'none' as const
  };
});

const cycleTag = () => {
  if (!props.updateAttributes) return;
  
  const tags = ['desc', 'dialog', 'thought'];
  const currentTag = props.node?.attrs?.semanticTag || 'desc';
  const currentIndex = tags.indexOf(currentTag);
  const nextTag = tags[(currentIndex + 1) % tags.length];
  
  props.updateAttributes({
    semanticTag: nextTag
  });
};
</script>

<style scoped>
.semantic-paragraph-node {
  margin-bottom: 0.5em;
}

.semantic-tag-badge:hover {
  filter: brightness(1.2);
  transform: scale(1.05);
}

.content-wrapper {
  /* Ensure paragraph text behaves correctly */
  display: block;
}
</style>
