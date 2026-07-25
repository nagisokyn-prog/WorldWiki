import { ref } from 'vue';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';

export function useTiptapMarkdown(editor: any, emit: any, updateStats: Function) {
  const markdownContent = ref('');
  
  const turndownService = new TurndownService();
  turndownService.addRule('denseParagraph', {
    filter: 'p',
    replacement: function (content: any) {
      return '\n' + content + '\n';
    }
  });
  const mdIt = new MarkdownIt();

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
      markdownContent.value = turndownService.turndown(html);
    } catch (err) {
      console.log('Turndown error (non-critical):', err);
    }
  };

  const onMarkdownInput = () => {
    try {
      const processed = preprocessMarkdown(markdownContent.value);
      const html = mdIt.render(processed);
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

  return {
    markdownContent,
    turndownService,
    mdIt,
    preprocessMarkdown,
    syncMarkdownFromEditor,
    onMarkdownInput
  };
}
