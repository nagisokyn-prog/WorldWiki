<template>
  <node-view-wrapper class="semantic-paragraph-node" :class="node.attrs.semanticTag || 'desc'" style="position: relative; padding-left: 24px; min-height: 24px;">
    
    <!-- Tag Badge -->
    <div 
      contenteditable="false" 
      class="semantic-tag-badge interactive-el" 
      :title="tagTooltip"
      :style="badgeStyle"
      @click="cycleTag"
    >
      {{ tagLabel }}
    </div>

    <!-- Content (Paragraph Text) -->
    <node-view-content class="content-wrapper" />
    
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3';
import { useSemanticParagraphNode } from './useSemanticParagraphNode';

const props = defineProps({
  ...nodeViewProps
});

const {
  tagLabel,
  tagTooltip,
  badgeStyle,
  cycleTag
} = useSemanticParagraphNode(props);
</script>

<style scoped src="./SemanticParagraphNode.vue.css"></style>
