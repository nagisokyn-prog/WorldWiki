import { Node, mergeAttributes } from '@tiptap/core';

export interface EntityReferenceOptions {
  HTMLAttributes: Record<string, unknown>;
  onEntityClick?: (entity: { id: string; type: string; name: string }) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    entityReference: {
      insertEntityReference: (attrs: { id: string; entityType: string; name: string; url?: string }) => ReturnType;
    };
  }
}

export const EntityReferenceExtension = Node.create<EntityReferenceOptions>({
  name: 'entityReference',
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
      id: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-id') || '',
        renderHTML: (attrs) => ({ 'data-id': attrs.id }),
      },
      entityType: {
        default: 'character',
        parseHTML: (el) => el.getAttribute('data-entity-type') || 'character',
        renderHTML: (attrs) => ({ 'data-entity-type': attrs.entityType }),
      },
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-name') || el.textContent || '',
        renderHTML: (attrs) => ({ 'data-name': attrs.name }),
      },
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') || '',
        renderHTML: (attrs) => (attrs.url ? { 'data-url': attrs.url } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="entity-reference"]',
      },
      {
        tag: 'span.entity-mention',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const name = HTMLAttributes['data-name'] || 'Сущность';
    const type = HTMLAttributes['data-entity-type'] || 'character';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'entity-reference',
        class: `word-entity-badge word-entity-${type}`,
        style: 'display: inline-flex; align-items: center; padding: 1px 6px; margin: 0 2px; border-radius: var(--radius-xs); background: var(--info-bg); color: var(--info); font-weight: 500; cursor: pointer; text-decoration: none; user-select: all;',
      }),
      name,
    ];
  },

  addCommands() {
    return {
      insertEntityReference:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
