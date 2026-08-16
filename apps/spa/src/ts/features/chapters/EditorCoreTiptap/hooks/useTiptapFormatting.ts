import { ref } from 'vue';

export function useTiptapFormatting(editor: any, emit: any, editorUpdateKey: any) {
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

  const insertFootnote = () => {
    const text = prompt('Введите текст сноски:');
    if (!text || !editor.value) return;
    const id = `fn${Object.keys(footnotes.value).length + 1}`;
    footnotes.value[id] = { id, text };
    editor.value.chain().focus().insertContent(`[^${id}]`).run();
    emit('update:footnotesData', footnotes.value);
    emit('change');
  };

  const deleteFootnote = async (id: string) => {
    const { appConfirm } = await import('@worldwiki/components');
    if (await appConfirm('Удалить сноску?')) {
      delete footnotes.value[id];
      emit('update:footnotesData', footnotes.value);
      emit('change');
    }
  };

  const cycleGlobalTag = (pIndex: number) => {
    if (!editor.value) return;
    
    let currentPIndex = 0;
    let targetPos = -1;
    let targetNode: any = null;
    
    editor.value.state.doc.descendants((node: any, pos: number) => {
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
      const currentTag = targetNode.attrs.semanticTag || 'desc';
      const nextTag = currentTag === 'desc' ? 'dialog' : (currentTag === 'dialog' ? 'thought' : 'desc');
      
      editor.value.view.dispatch(
        editor.value.state.tr.setNodeMarkup(targetPos, undefined, {
          ...targetNode.attrs,
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
    insertFootnote,
    deleteFootnote,
    cycleGlobalTag
  };
}
