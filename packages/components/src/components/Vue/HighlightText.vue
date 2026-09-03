<template>
  <span class="highlight-text">
    <template v-for="(part, idx) in parts" :key="idx">
      <mark v-if="part.isMatch" class="highlight-match">{{ part.text }}</mark>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<script setup lang="ts">
import { 
  useHighlightText, 
  type HighlightTextProps, 
  type TextPart 
} from './useHighlightText';

export type { TextPart };

const props = withDefaults(defineProps<HighlightTextProps>(), {
  query: ''
});

const { parts } = useHighlightText(props);
</script>
