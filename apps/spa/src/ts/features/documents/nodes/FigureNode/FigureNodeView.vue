<template>
  <node-view-wrapper
    class="ww-figure-node"
    :class="`align-${alignment}`"
    :data-node-id="props.node.attrs.id"
  >
    <div
      class="ww-figure-wrapper"
      :class="{ 'is-selected': props.selected }"
      :style="{ width }"
    >
      <img
        :src="src"
        :alt="caption || 'Иллюстрация'"
        class="ww-figure-image"
      />
      <div
        class="ww-figure-resizer"
        title="Потяните для изменения размера"
        @mousedown="startResize"
      ></div>
    </div>

    <figcaption class="ww-figure-caption-bar">
      <span class="ww-figure-prefix">{{ prefixLabel }}</span>
      <input
        type="text"
        class="ww-figure-caption-input"
        :value="caption"
        placeholder="Введите подпись к рисунку..."
        @input="e => updateCaption((e.target as HTMLInputElement).value)"
      />
    </figcaption>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3';
import type { FigureNodeViewProps } from './FigureNodeView.model';
import { useFigureNodeView } from './useFigureNodeView';

const props = defineProps<FigureNodeViewProps>();

const {
  src,
  caption,
  alignment,
  width,
  prefixLabel,
  updateCaption,
  startResize
} = useFigureNodeView(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/FigureNodeView.css"></style>
