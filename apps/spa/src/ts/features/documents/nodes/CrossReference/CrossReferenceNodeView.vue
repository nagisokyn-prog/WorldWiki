<template>
  <node-view-wrapper
    as="span"
    class="ww-crossref-node"
    :class="{ 'is-broken': isBroken }"
    :title="isBroken ? 'Целевой объект удален' : 'Перейти к объекту'"
    @click="jumpToTarget"
  >
    <span class="ww-crossref-icon">{{ icon }}</span>
    <span class="ww-crossref-label">{{ resolvedLabel }}</span>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3';
import type { CrossReferenceNodeViewProps } from './CrossReferenceNodeView.model';
import { useCrossReferenceNodeView } from './useCrossReferenceNodeView';

const props = defineProps<CrossReferenceNodeViewProps>();

const {
  isBroken,
  resolvedLabel,
  icon,
  jumpToTarget
} = useCrossReferenceNodeView(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/CrossReferenceNodeView.css"></style>
