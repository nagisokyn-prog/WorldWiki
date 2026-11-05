import { ref } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export function useTiptapFormatting(
  editor: ShallowRef<Editor | null | undefined> | Ref<Editor | null | undefined>,
  emit: (event: string, ...args: unknown[]) => void,
  editorUpdateKey: Ref<number>
) {
  const footnotes = ref<Record<string, {id: string, text: string}>>({});

  const toggleBold = () => editor.value?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.value?.chain().focus().toggleItalic().run();
  const toggleStrike = () => editor.value?.chain().focus().toggleStrike().run();
  const setHeading = (level: number) => editor.value?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  const toggleBlockquote = () => editor.value?.chain().focus().toggleBlockquote().run();
  const toggleBulletList = () => editor.value?.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.value?.chain().focus().toggleOrderedList().run();

  const insertImage = () => {
    const url = prompt('URL изображения:');
    if (url && editor.value) {
      editor.value.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertLink = () => {
    const text = prompt('Текст ссылки:', 'ссылка');
    const url = prompt('URL:');
    if (text && url && editor.value) {
      editor.value.chain().focus().setLink({ href: url }).insertContent(text).run();
    }
  };

  const insertTable = () => {
    if (!editor.value) return;
    editor.value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const clearFormatting = () => {
    if (!editor.value) return;
    editor.value.chain().focus().clearNodes().unsetLink().run();
  };


  const cycleGlobalTag = (pIndex: number) => {
    if (!editor.value) return;
    
    let currentPIndex = 0;
    let targetPos = -1;
    let targetNode: ProseMirrorNode | null = null;
    
    editor.value.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
      if (node.type.name === 'paragraph') {
        if (currentPIndex === pIndex) {
          targetPos = pos;
          targetNode = node;
          return false;
        }
        currentPIndex++;
      }
    });
    
    if (targetPos !== -1 && targetNode) {
      const currentTag = (targetNode as ProseMirrorNode).attrs.semanticTag || 'desc';
      const nextTag = currentTag === 'desc' ? 'dialog' : (currentTag === 'dialog' ? 'thought' : 'desc');
      
      editor.value.view.dispatch(
        editor.value.state.tr.setNodeMarkup(targetPos, undefined, {
          ...(targetNode as ProseMirrorNode).attrs,
          semanticTag: nextTag
        })
      );
      editorUpdateKey.value++;
      emit('change');
    }
  };

  return {
    footnotes,
    toggleBold,
    toggleItalic,
    toggleStrike,
    setHeading,
    toggleBlockquote,
    toggleBulletList,
    toggleOrderedList,
    insertImage,
    insertLink,
    insertTable,
    clearFormatting,
    cycleGlobalTag
  };
}
