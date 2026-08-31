import { Node, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import CrossReferenceNodeView from './CrossReferenceNodeView.vue';

export const CrossReferenceExtension = Node.create({
  name: 'cross_reference',
  inline: true,
  group: 'inline',
  atom: true,

  addAttributes() {
    return {
      targetId: { default: '' },
      kind: { default: 'figure' },
      displayMode: { default: 'full' },
      resolvedLabel: { default: 'Ссылка' },
      isBroken: { default: false }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-node-type="cross-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-node-type': 'cross-reference' }, HTMLAttributes)];
  },

  addNodeView() {
    return VueNodeViewRenderer(CrossReferenceNodeView);
  }
});
