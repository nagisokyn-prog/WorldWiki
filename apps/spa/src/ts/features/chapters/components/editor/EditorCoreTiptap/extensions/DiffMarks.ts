import { Mark, mergeAttributes } from '@tiptap/core';

export const DiffInsertion = Mark.create({
  name: 'diffInsertion',

  parseHTML() {
    return [
      { tag: 'ins' },
      { tag: 'span.diff-ins' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(HTMLAttributes, { class: 'diff-ins' }), 0];
  },
});

export const DiffDeletion = Mark.create({
  name: 'diffDeletion',

  parseHTML() {
    return [
      { tag: 'del' },
      { tag: 'span.diff-del' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes(HTMLAttributes, { class: 'diff-del' }), 0];
  },
});

