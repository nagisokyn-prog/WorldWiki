<template>
  <node-view-wrapper class="semantic-paragraph-node" :class="node.attrs.semanticTag || 'desc'">
    <!-- Tag Badge -->
    <div 
      contenteditable="false" 
      class="semantic-tag-badge interactive-el" 
      :class="tagClass"
      :title="tagTooltip"
      @click="cycleTag"
    >
      {{ tagLabel }}
    </div>

    <!-- Content (Paragraph Text) -->
    <node-view-content class="content-wrapper" />
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/vue-3';
import { useSemanticParagraphNode } from './useSemanticParagraphNode';

const props = defineProps<NodeViewProps>();

const {
  tagLabel,
  tagTooltip,
  tagClass,
  cycleTag
} = useSemanticParagraphNode(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/SemanticParagraphNode.css"></style>
