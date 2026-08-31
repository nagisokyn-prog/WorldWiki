import { Node, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import FigureNodeView from './FigureNodeView.vue';

export const FigureExtension = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null },
      src: { default: '' },
      caption: { default: '' },
      computedNumber: { default: '' },
      numberingMode: { default: 'global' },
      alignment: { default: 'center' },
      width: { default: '100%' }
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-node-type="figure"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes({ 'data-node-type': 'figure' }, HTMLAttributes)];
  },

  addNodeView() {
    return VueNodeViewRenderer(FigureNodeView);
  }
});
