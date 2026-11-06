import { Extension, VueNodeViewRenderer } from '@tiptap/vue-3';
import Paragraph from '@tiptap/extension-paragraph';
import SemanticParagraphNode from '@/features/chapters/components/semantic/Semantic/SemanticParagraphNode.vue';
import { detectActiveEntityQuery } from '@/services/Manuscript/manuscript.wasm-bridge';

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
      '(': ({ editor }) => {
        const { state } = editor;
        const { from, to, empty } = state.selection;
        if (!empty && to > from) {
          const selectedText = state.doc.textBetween(from, to, ' ');
          if (selectedText.trim()) {
            editor.chain().focus().insertContentAt({ from, to }, `((${selectedText}))`).run();
            document.dispatchEvent(new CustomEvent('ww:open-entity-selector', {
              detail: { target: 'wysiwyg', query: selectedText.trim() }
            }));
            return true;
          }
        }
        return false;
      },
      'Mod-q': ({ editor }) => {
        const { state } = editor;
        const { from, to, empty } = state.selection;
        if (!empty && to > from) {
          const selectedText = state.doc.textBetween(from, to, ' ');
          if (selectedText.trim()) {
            editor.chain().focus().insertContentAt({ from, to }, `((${selectedText}))`).run();
            document.dispatchEvent(new CustomEvent('ww:open-entity-selector', {
              detail: { target: 'wysiwyg', query: selectedText.trim() }
            }));
            return true;
          }
        }
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        const trigger = detectActiveEntityQuery(textBefore);
        if (trigger) {
          document.dispatchEvent(new CustomEvent('ww:open-entity-selector', {
            detail: { target: 'wysiwyg', query: trigger.query }
          }));
          return true;
        }
        document.dispatchEvent(new CustomEvent('ww:open-entity-selector', { detail: { target: 'wysiwyg' } }));
        return true;
      },
      'Mod-й': ({ editor }) => {
        const { state } = editor;
        const { from, to, empty } = state.selection;
        if (!empty && to > from) {
          const selectedText = state.doc.textBetween(from, to, ' ');
          if (selectedText.trim()) {
            editor.chain().focus().insertContentAt({ from, to }, `((${selectedText}))`).run();
            document.dispatchEvent(new CustomEvent('ww:open-entity-selector', {
              detail: { target: 'wysiwyg', query: selectedText.trim() }
            }));
            return true;
          }
        }
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        const trigger = detectActiveEntityQuery(textBefore);
        if (trigger) {
          document.dispatchEvent(new CustomEvent('ww:open-entity-selector', {
            detail: { target: 'wysiwyg', query: trigger.query }
          }));
          return true;
        }
        document.dispatchEvent(new CustomEvent('ww:open-entity-selector', { detail: { target: 'wysiwyg' } }));
        return true;
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
