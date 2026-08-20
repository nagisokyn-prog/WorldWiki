<template>
  <node-view-wrapper class="semantic-block">
    <div 
      class="semantic-tag-badge interactive-el" 
      contenteditable="false" 
      :class="currentTag"
      :title="tagTitle"
      @click="cycleTag"
    >
      {{ tagDisplay }}
    </div>
    <node-view-content class="semantic-content" />
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/vue-3';
import { useSemanticParagraph, type SemanticParagraphProps } from './useSemanticParagraph';

const props = defineProps<NodeViewProps>();

const {
  currentTag,
  tagDisplay,
  tagTitle,
  cycleTag
} = useSemanticParagraph(props as unknown as SemanticParagraphProps);
</script>

<style scoped src="./SemanticParagraph.vue.css"></style>
