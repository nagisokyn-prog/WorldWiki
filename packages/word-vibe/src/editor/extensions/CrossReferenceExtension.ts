import { Node, mergeAttributes } from '@tiptap/core';

export interface CrossReferenceOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    crossReference: {
      insertCrossReference: (attrs: { targetId: string; kind: string; displayMode?: string }) => ReturnType;
    };
  }
}

export const CrossReferenceExtension = Node.create<CrossReferenceOptions>({
  name: 'crossReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      targetId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-target-id') || '',
        renderHTML: (attrs) => ({ 'data-target-id': attrs.targetId }),
      },
      kind: {
        default: 'heading',
        parseHTML: (el) => el.getAttribute('data-kind') || 'heading',
        renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
      },
      displayMode: {
        default: 'full',
        parseHTML: (el) => el.getAttribute('data-display-mode') || 'full',
        renderHTML: (attrs) => ({ 'data-display-mode': attrs.displayMode }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="cross-reference"]',
      },
      {
        tag: 'span.cross-reference',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const kind = HTMLAttributes['data-kind'] || 'раздел';
    let label = `[см. ${kind}]`;
    if (kind === 'table') label = '[см. таблицу]';
    else if (kind === 'figure') label = '[см. рисунок]';
    else if (kind === 'equation') label = '[см. формулу]';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'cross-reference',
        class: 'word-cross-reference',
        style: 'display: inline; color: var(--accent); cursor: pointer; text-decoration: underline dotted; font-style: italic;',
      }),
      label,
    ];
  },

  addCommands() {
    return {
      insertCrossReference:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
