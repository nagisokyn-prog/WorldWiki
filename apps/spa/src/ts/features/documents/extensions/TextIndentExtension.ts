import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textIndent: {
      setFirstLineIndent: (indent: string | number) => ReturnType;
      unsetFirstLineIndent: () => ReturnType;
    };
  }
}

export const TextIndentExtension = Extension.create({
  name: 'textIndent',

  addOptions() {
    return {
      types: ['paragraph'],
      defaultIndent: '12.5mm' // ГОСТ: 1.25 см
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          firstLineIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => {
              if (!attributes.firstLineIndent) {
                return {};
              }
              const value = typeof attributes.firstLineIndent === 'number'
                ? `${attributes.firstLineIndent}mm`
                : attributes.firstLineIndent;
              return {
                style: `text-indent: ${value}`
              };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setFirstLineIndent:
        (indent: string | number) =>
        ({ commands }) => {
          const value = typeof indent === 'number' ? `${indent}mm` : String(indent);
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { firstLineIndent: value })
          );
        },
      unsetFirstLineIndent:
        () =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.resetAttributes(type, 'firstLineIndent')
          );
        }
    };
  }
});
