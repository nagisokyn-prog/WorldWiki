import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string | number) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeightExtension = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultLineHeight: '1.5'
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) {
                return {};
              }
              return {
                style: `line-height: ${attributes.lineHeight}`
              };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string | number) =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineHeight: String(lineHeight) })
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.resetAttributes(type, 'lineHeight')
          );
        }
    };
  }
});
