import { Extension, VueNodeViewRenderer } from '@tiptap/vue-3';
import Paragraph from '@tiptap/extension-paragraph';
import SemanticParagraphNode from '../../Semantic/SemanticParagraphNode.vue';

export const EnterHandler = Extension.create({
  name: 'enterHandler',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        return false;
      },
      'Shift-Enter': ({ editor }) => {
        return editor.commands.setHardBreak();
      },
      'Mod-q': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        if (/\(\([^)]*\)\)$/.test(textBefore)) {
          document.dispatchEvent(new CustomEvent('ww:open-entity-selector', { detail: { target: 'wysiwyg' } }));
          return true;
        }
        return false;
      },
      'Mod-й': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        if (/\(\([^)]*\)\)$/.test(textBefore)) {
          document.dispatchEvent(new CustomEvent('ww:open-entity-selector', { detail: { target: 'wysiwyg' } }));
          return true;
        }
        return false;
      }
    };
  }
});

export const SemanticParagraph = Paragraph.extend({
  addAttributes() {
    return {
      semanticTag: {
        default: 'desc',
        parseHTML: (element) => element.getAttribute('data-semantic-tag'),
        renderHTML: (attributes) => ({
          'data-semantic-tag': attributes.semanticTag
        })
      },
      textIndent: {
        default: null,
        parseHTML: (element) => element.style.textIndent || null,
        renderHTML: (attributes) => (attributes.textIndent ? { style: `text-indent: ${attributes.textIndent}` } : {})
      },
      leftIndent: {
        default: null,
        parseHTML: (element) => element.style.paddingLeft || null,
        renderHTML: (attributes) => (attributes.leftIndent ? { style: `padding-left: ${attributes.leftIndent}` } : {})
      },
      rightIndent: {
        default: null,
        parseHTML: (element) => element.style.paddingRight || null,
        renderHTML: (attributes) => (attributes.rightIndent ? { style: `padding-right: ${attributes.rightIndent}` } : {})
      },
      lineHeight: {
        default: null,
        parseHTML: (element) => element.style.lineHeight || null,
        renderHTML: (attributes) => (attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {})
      },
      textAlign: {
        default: null,
        parseHTML: (element) => element.style.textAlign || null,
        renderHTML: (attributes) => (attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {})
      }
    };
  },
  addNodeView() {
    return VueNodeViewRenderer(SemanticParagraphNode);
  }
});
