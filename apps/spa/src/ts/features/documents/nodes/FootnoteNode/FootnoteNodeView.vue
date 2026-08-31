<template>
  <node-view-wrapper as="span" class="ww-footnote-node" :class="{ 'is-active': isOpen }">
    <sup class="ww-footnote-badge" @click="togglePopover">
      [{{ footnoteNumber }}]
    </sup>

    <div v-if="isOpen" class="ww-footnote-popover" @click.stop>
      <div class="ww-footnote-popover-header">
        <span>Сноска [{{ footnoteNumber }}]</span>
        <button
          type="button"
          class="btn-icon interactive-el"
          title="Закрыть"
          @click="closePopover"
        >
          ✕
        </button>
      </div>
      <textarea
        class="ww-footnote-textarea"
        :value="footnoteText"
        placeholder="Текст сноски (библиографическая ссылка, пояснение)..."
        @input="e => updateContent((e.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3';
import type { FootnoteNodeViewProps } from './FootnoteNodeView.model';
import { useFootnoteNodeView } from './useFootnoteNodeView';

const props = defineProps<FootnoteNodeViewProps>();

const {
  isOpen,
  footnoteNumber,
  footnoteText,
  togglePopover,
  closePopover,
  updateContent
} = useFootnoteNodeView(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/FootnoteNodeView.css"></style>
