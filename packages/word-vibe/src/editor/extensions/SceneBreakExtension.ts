import { Node, mergeAttributes } from '@tiptap/core';

export interface SceneBreakOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneBreak: {
      insertSceneBreak: (variant?: 'asterisms' | 'line' | 'space') => ReturnType;
    };
  }
}

export const SceneBreakExtension = Node.create<SceneBreakOptions>({
  name: 'sceneBreak',
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
        default: null,
        parseHTML: (el) => el.getAttribute('data-id'),
        renderHTML: (attrs) => (attrs.id ? { 'data-id': attrs.id } : {}),
      },
      variant: {
        default: 'asterisms',
        parseHTML: (el) => el.getAttribute('data-variant') || 'asterisms',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant || 'asterisms' }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="scene-break"]',
      },
      {
        tag: 'hr.scene-break',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = HTMLAttributes['data-variant'] || 'asterisms';
    let text = '* * *';
    if (variant === 'line') text = '― ― ―';
    else if (variant === 'space') text = '';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'scene-break',
        class: `word-scene-break word-scene-break-${variant}`,
        style: 'text-align: center; margin: 1.5em 0; user-select: none; font-weight: bold; letter-spacing: 0.5em;',
      }),
      text,
    ];
  },

  addCommands() {
    return {
      insertSceneBreak:
        (variant = 'asterisms') =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { variant } }).run(),
    };
  },
});
