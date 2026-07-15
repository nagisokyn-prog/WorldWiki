/**
 * @file editor.service.ts
 * @description Сервис для работы с редактором
 * @note DOM-зависимый, не rust-ready
 */

interface EditorOptions {
  height?: string;
  initialEditType?: 'wysiwyg' | 'markdown';
  previewStyle?: string;
  toolbarItems?: string[][];
  onChange?: () => void;
}

class EditorService {
  editor: unknown = null;
  autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;
  onChangeCallback: (() => void) | null = null;

  init(containerId: string, options: EditorOptions = {}): unknown {
    const editorEl = document.getElementById(containerId);
    if (!editorEl) throw new Error(`Editor container #${containerId} not found`);

    const config = {
      el: editorEl,
      height: options.height || '100%',
      initialEditType: options.initialEditType || 'wysiwyg',
      previewStyle: options.previewStyle || 'tab',
      usageStatistics: false,
      language: 'ru',
      toolbarItems: options.toolbarItems || [
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task'],
        ['table', 'image', 'link'],
        ['code', 'codeblock'],
        ['scrollSync']
      ],
      hooks: {
        addImageBlobHook: (blob: Blob, callback: (url: string, alt: string) => void) => {
          const reader = new FileReader();
          reader.onload = () => callback(reader.result as string, 'image');
          reader.readAsDataURL(blob);
        }
      }
    };

    const toastui = (window as unknown as Record<string, unknown>).toastui as { Editor?: { factory: (config: unknown) => unknown } } | undefined;
    this.editor = toastui?.Editor?.factory(config);

    if (options.onChange && this.editor) {
      const editor = this.editor as { on?: (event: string, cb: () => void) => void };
      editor.on?.('change', options.onChange);
    }

    (window as unknown as Record<string, unknown>).editorInstance = this.editor;
    return this.editor;
  }

  getContent(): string {
    const editor = this.editor as { getMarkdown?: () => string } | null;
    return editor?.getMarkdown?.() || '';
  }

  setContent(content: string): void {
    const editor = this.editor as { setMarkdown?: (content: string) => void } | null;
    if (editor) editor.setMarkdown?.(content || '');
  }

  getWordCount(): number {
    const content = this.getContent();
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }

  getCharCount(): number {
    return this.getContent().length;
  }

  switchMode(mode: string): void {
    const editor = this.editor as { changeMode?: (mode: string) => void; setMode?: (mode: string) => void } | null;
    if (!editor) return;
    if (editor.changeMode) editor.changeMode(mode);
    else if (editor.setMode) editor.setMode(mode);
  }

  getCurrentMode(): string {
    const editor = this.editor as { getCurrentMode?: () => string; isWysiwygMode?: () => boolean } | null;
    if (!editor) return 'wysiwyg';
    if (editor.getCurrentMode) return editor.getCurrentMode();
    if (editor.isWysiwygMode) return editor.isWysiwygMode() ? 'wysiwyg' : 'markdown';
    return 'wysiwyg';
  }

  insertText(text: string): void {
    const editor = this.editor as { insertText?: (text: string) => void } | null;
    if (editor) editor.insertText?.(text);
  }

  replaceSelection(text: string): void {
    const editor = this.editor as { replaceSelection?: (text: string) => void } | null;
    if (editor) editor.replaceSelection?.(text);
  }

  getSelectedText(): string {
    const editor = this.editor as { getSelectedText?: () => string } | null;
    if (!editor) return '';
    return editor.getSelectedText?.() || '';
  }

  autoSave(callback: () => void, delay: number = 30000): void {
    if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      callback();
      this.autoSaveTimeout = null;
    }, delay);
  }

  cancelAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
  }
}

export const editorService = new EditorService();

declare global {
  interface Window {
    editorService: EditorService;
    editorInstance: unknown;
  }
}

if (typeof window !== 'undefined') {
  window.editorService = editorService;
}