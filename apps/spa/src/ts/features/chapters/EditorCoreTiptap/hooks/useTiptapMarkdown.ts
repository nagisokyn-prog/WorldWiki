import { ref } from 'vue';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';

export function useTiptapMarkdown(editor: any, emit: any, updateStats: (...args: any[]) => void) {
  const markdownContent = ref('');
  
  const turndownService = new TurndownService();
  turndownService.addRule('denseParagraph', {
    filter: 'p',
    replacement: function (content: any) {
      return '\n' + content + '\n';
    }
  });
  turndownService.addRule('entityLinks', {
    filter: function (node) {
      return node.nodeName === 'A' && !!node.getAttribute('href')?.includes('ui_editor.html');
    },
    replacement: function (content: string, node: HTMLElement) {
      const href = node.getAttribute('href')?.replace(/^\//, '') || '';
      return `((${content}))[${href}]`;
    }
  });
  const mdIt = new MarkdownIt({ html: true });

  const preprocessMarkdown = (text: string) => {
    const lines = text.split('\n');
    let inCode = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('```')) inCode = !inCode;
      out.push(line);
      
      if (!inCode && i < lines.length - 1) {
        const nextLine = lines[i+1];
        if (line.trim() !== '' && nextLine.trim() !== '') {
          const isCurrentQuote = line.trim().startsWith('>');
          const isNextQuote = nextLine.trim().startsWith('>');
          const isSoftBreak = line.endsWith('  ') || line.endsWith('\\');
          
          if (!isSoftBreak && !(isCurrentQuote && isNextQuote)) {
            out.push('');
          }
        }
      }
    }
    return out.join('\n');
  };

  const syncMarkdownFromEditor = () => {
    if (!editor.value) return;
    const html = editor.value.getHTML();
    try {
      let md = turndownService.turndown(html);
      md = md.replace(/\\\(\\\((.*?)\\\)\\\)\\\[(ui_editor\.html.*?)\\\]/g, '(($1))[$2]');
      markdownContent.value = md;
    } catch (err) {
      console.log('Turndown error (non-critical):', err);
    }
  };

  const onMarkdownInput = () => {
    try {
      const processed = preprocessMarkdown(markdownContent.value);
      let html = mdIt.render(processed);
      // Transform custom syntax to standard HTML links for Tiptap
      html = html.replace(/\(\((.*?)\)\)\[(ui_editor\.html[^\]]+)\]/g, '<a href="/$2">$1</a>');
      if (editor.value) {
        editor.value.commands.setContent(html);
      }
      emit('update:content', html);
      emit('change');
      updateStats();
    } catch (err) {
      console.error('Markdown parse error:', err);
    }
  };

  const onMarkdownKeydown = (e: KeyboardEvent) => {
    if (e.key === '(') {
      const target = e.target as HTMLTextAreaElement;
      if (target && target.selectionStart !== target.selectionEnd) {
        e.preventDefault();
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const text = target.value;
        const selected = text.substring(start, end);
        
        document.execCommand('insertText', false, '(' + selected + ')');
        
        // Restore selection around the text
        target.setSelectionRange(start + 1, start + 1 + selected.length);
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'q' || e.code === 'KeyQ' || e.key === 'й' || e.key === 'Й')) {
      const target = e.target as HTMLTextAreaElement;
      if (target) {
        const textBefore = target.value.substring(0, target.selectionStart);
        if (/\(\([^)]+\)\)$/.test(textBefore)) {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('ww:open-entity-selector', { detail: { target: 'markdown' } }));
        }
      }
    }
  };

  return {
    markdownContent,
    turndownService,
    mdIt,
    preprocessMarkdown,
    syncMarkdownFromEditor,
    onMarkdownInput,
    onMarkdownKeydown
  };
}
