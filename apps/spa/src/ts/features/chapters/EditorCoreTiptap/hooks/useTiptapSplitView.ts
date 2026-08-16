import { ref, computed } from 'vue';

export function useTiptapSplitView(editor: any, editorUpdateKey: any) {
  const showStructure = ref(localStorage.getItem('split-view-show-structure') !== 'false');
  const leftPanelWidth = ref(40);
  const rightPanelWidth = ref(35);
  const resizing = ref<'left' | 'middle' | null>(null);
  const selectedBlockIdx = ref(-1);

  // Load saved widths
  const savedLeftWidth = localStorage.getItem('split-view-left-width');
  const savedRightWidth = localStorage.getItem('split-view-right-width');
  if (savedLeftWidth) leftPanelWidth.value = parseFloat(savedLeftWidth);
  if (savedRightWidth) rightPanelWidth.value = parseFloat(savedRightWidth);

  const startResizeLeft = (e: MouseEvent) => {
    e.preventDefault();
    resizing.value = 'left';
    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;
    
    const startX = e.clientX;
    const startLeftWidth = leftPanelWidth.value;
    const containerWidth = container.offsetWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      leftPanelWidth.value = Math.max(20, Math.min(60, startLeftWidth + deltaPercent));
    };
    
    const onMouseUp = () => {
      resizing.value = null;
      localStorage.setItem('split-view-left-width', leftPanelWidth.value.toString());
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizeRight = (e: MouseEvent) => {
    e.preventDefault();
    resizing.value = 'middle';
    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;
    
    const startX = e.clientX;
    const startRightWidth = rightPanelWidth.value;
    const containerWidth = container.offsetWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      rightPanelWidth.value = Math.max(20, Math.min(60, startRightWidth + deltaPercent));
    };
    
    const onMouseUp = () => {
      resizing.value = null;
      localStorage.setItem('split-view-right-width', rightPanelWidth.value.toString());
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const documentStructure = computed(() => {
    void editorUpdateKey.value;
    if (!editor.value) return [];
    const doc = editor.value.getJSON();
    const blocks: Array<{ type: string; text: string; level?: number; semanticTag?: string; pIndex?: number }> = [];
    
    let pIndexCounter = 0;
    
    function traverse(node: any, depth = 0) {
      if (!node) return;
      
      if (Array.isArray(node)) {
        node.forEach((n: any) => traverse(n, depth));
      } else if (node.type) {
        let text = '';
        const type = node.type;
        
        if (node.content) {
          node.content.forEach((c: any) => {
            if (c.type === 'text' && c.text) text += c.text;
          });
        }
        
        text = text.substring(0, 60);
        if (text.length === 60) text += '...';
        
        if (type === 'heading') {
          blocks.push({ type: `H${node.attrs?.level || 1}`, text, level: node.attrs?.level });
        } else if (type === 'paragraph') {
          blocks.push({ type: 'Paragraph', text, semanticTag: node.attrs?.semanticTag || 'desc', pIndex: pIndexCounter });
          pIndexCounter++;
        } else if (type === 'bulletList' || type === 'orderedList') {
          blocks.push({ type: type === 'bulletList' ? 'List' : 'Ordered', text: `(${node.content?.length || 0} items)` });
        } else if (type === 'blockquote') {
          blocks.push({ type: 'Quote', text });
        } else if (type === 'codeBlock') {
          blocks.push({ type: 'Code', text });
        } else if (type === 'table') {
          blocks.push({ type: 'Table', text: `(${node.content?.length || 0} rows)` });
        }
        
        if (node.content) {
          node.content.forEach((c: any) => traverse(c, depth + 1));
        }
      }
    }
    
    if (doc.content) traverse(doc);
    return blocks;
  });

  const scrollToBlock = (idx: number) => {
    selectedBlockIdx.value = idx;
  };

  return {
    showStructure,
    leftPanelWidth,
    rightPanelWidth,
    resizing,
    selectedBlockIdx,
    documentStructure,
    startResizeLeft,
    startResizeRight,
    scrollToBlock
  };
}
