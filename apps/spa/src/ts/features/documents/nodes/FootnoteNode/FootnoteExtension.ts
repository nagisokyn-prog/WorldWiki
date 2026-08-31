import { Node, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import FootnoteNodeView from './FootnoteNodeView.vue';

export const FootnoteExtension = Node.create({
  name: 'footnote_reference',
  inline: true,
  group: 'inline',
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      computedNumber: { default: 1 },
      content: { default: '' }
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-node-type="footnote"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes({ 'data-node-type': 'footnote' }, HTMLAttributes)];
  },

  addNodeView() {
    return VueNodeViewRenderer(FootnoteNodeView);
  }
});
