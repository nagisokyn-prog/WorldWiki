import { Node, mergeAttributes } from '@tiptap/core';

export interface UnsupportedBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    unsupportedBlock: {
      insertUnsupportedBlock: (attrs: {
        id: string;
        originalType: string;
        originalAttrs?: Record<string, unknown>;
        originalContent?: unknown[];
        reason?: string;
      }) => ReturnType;
    };
  }
}

export const UnsupportedBlockExtension = Node.create<UnsupportedBlockOptions>({
  name: 'unsupportedBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-id') || '',
        renderHTML: (attrs) => ({ 'data-id': attrs.id }),
      },
      originalType: {
        default: 'unknown',
        parseHTML: (el) => el.getAttribute('data-original-type') || 'unknown',
        renderHTML: (attrs) => ({ 'data-original-type': attrs.originalType }),
      },
      originalAttrs: {
        default: () => ({}),
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-original-attrs') || '{}');
          } catch {
            return {};
          }
        },
        renderHTML: (attrs) => ({
          'data-original-attrs': JSON.stringify(attrs.originalAttrs || {}),
        }),
      },
      originalContent: {
        default: () => [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-original-content') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          'data-original-content': JSON.stringify(attrs.originalContent || []),
        }),
      },
      reason: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-reason') || '',
        renderHTML: (attrs) => (attrs.reason ? { 'data-reason': attrs.reason } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="unsupported-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const origType = HTMLAttributes['data-original-type'] || 'неизвестный блок';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'unsupported-block',
        class: 'word-unsupported-block',
        style: 'margin: 1em 0; padding: 10px 14px; border: 1px dashed #94a3b8; border-radius: 6px; background: rgba(148, 163, 184, 0.08); font-size: 0.9em; color: #64748b; user-select: none;',
      }),
      ['span', { style: 'font-weight: 600; color: #475569;' }, `⚠️ Блок «${origType}»`],
      ['span', { style: 'margin-left: 8px; opacity: 0.8;' }, '— доступен для редактирования в основном WYSIWYG'],
    ];
  },

  addCommands() {
    return {
      insertUnsupportedBlock:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
