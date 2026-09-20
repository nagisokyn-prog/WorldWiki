import { ref } from 'vue';
import type { AttachedSkill } from './AiMessageList.model';

export type { AttachedSkill };

export interface MessageContentSegment {
  type: 'markdown' | 'mermaid';
  content: string;
}

export interface QuotedContextItem {
  selected_text?: string;
  selectedText?: string;
  author?: string;
  [key: string]: unknown;
}

export function useAiMessageList() {
  const containerRef = ref<HTMLElement | null>(null);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('Ошибка копирования:', e);
    }
  };

  const isErrorMessage = (content?: string): boolean => {
    if (!content) return false;
    const trimmed = content.trim();
    return (
      trimmed.startsWith('🚫') ||
      trimmed.startsWith('⚠️') ||
      trimmed.startsWith('🔑') ||
      trimmed.startsWith('💳') ||
      trimmed.startsWith('🔍') ||
      trimmed.startsWith('🌐')
    );
  };

  const extractSkills = (rawContent?: string): { skills: AttachedSkill[]; cleanedContent: string } => {
    if (!rawContent) return { skills: [], cleanedContent: '' };

    const skills: AttachedSkill[] = [];
    const skillContextRegex = /<context\s+type=["']skill["'](?:\s+name=["']([^"']+)["'])?>([\s\S]*?)<\/context>/gi;

    let match: RegExpExecArray | null;
    while ((match = skillContextRegex.exec(rawContent)) !== null) {
      const name = match[1]?.trim() || 'skills';
      const content = match[2]?.trim() || '';
      skills.push({ name, content });
    }

    // Удаляем <context type="skill">...</context> блоки из отображаемого текста
    let cleanedContent = rawContent.replace(skillContextRegex, '').trim();

    // Если в сообщении остался префикс !"Название скилла", извлекаем его как скилл если еще не был извлечен
    const exclamationSkillRegex = /!"([^"]+)"/g;
    let excMatch: RegExpExecArray | null;
    while ((excMatch = exclamationSkillRegex.exec(cleanedContent)) !== null) {
      const excName = excMatch[1].trim();
      if (!skills.some(s => s.name.toLowerCase() === excName.toLowerCase())) {
        skills.push({ name: excName, content: '' });
      }
    }

    // Удаляем избыточный префикс !"Название скилла" из текста сообщения, если есть скилл-бейдж
    if (skills.length > 0) {
      cleanedContent = cleanedContent.replace(/!"([^"]+)"\s*/g, '').trim();
    }

    return { skills, cleanedContent };
  };

  const extractQuoteAndCleanContent = (
    rawContent?: string,
    quotedContext?: { selected_text?: string; selectedText?: string; author?: string }
  ): { quote: AttachedSkill | null; cleanedContent: string } => {
    let cleanedContent = rawContent || '';
    let quote: AttachedSkill | null = null;

    // 1. Проверяем объект quoted_context
    const structuredText = quotedContext?.selected_text || quotedContext?.selectedText;
    if (structuredText && structuredText.trim()) {
      quote = {
        name: quotedContext?.author || 'Цитата',
        content: structuredText.trim()
      };
    }

    // 2. Проверяем префикс [Цитата]: «...» или [Цитата]: "..."
    const quoteRegex = /(?:^|\n)(?:>\s*)?\[Цитата\]:\s*[«"]([\s\S]*?)[»"](?:\n+|$)/i;
    const match = quoteRegex.exec(cleanedContent);
    if (match) {
      if (!quote) {
        quote = {
          name: 'Цитата',
          content: match[1].trim()
        };
      }
      cleanedContent = cleanedContent.replace(quoteRegex, '\n').trim();
    }

    // 3. Проверяем XML-тег <quoted_context>
    const xmlQuoteRegex = /<quoted_context(?:\s+author=["']([^"']+)["'])?>([\s\S]*?)<\/quoted_context>/i;
    const xmlMatch = xmlQuoteRegex.exec(cleanedContent);
    if (xmlMatch) {
      if (!quote) {
        quote = {
          name: xmlMatch[1] || 'Цитата',
          content: xmlMatch[2].trim()
        };
      }
      cleanedContent = cleanedContent.replace(xmlQuoteRegex, '').trim();
    }

    return { quote, cleanedContent };
  };

  const getAttachedSkills = (content?: string): AttachedSkill[] => {
    return extractSkills(content).skills;
  };

  const getExtractedQuote = (message?: { content?: string; quoted_context?: QuotedContextItem | null; quotedContext?: QuotedContextItem | null }): { name: string; content: string } | null => {
    if (!message) return null;
    const qContext = (message.quoted_context || message.quotedContext) as QuotedContextItem | undefined;
    return extractQuoteAndCleanContent(message.content, qContext).quote;
  };

  const getCleanedContent = (content?: string, quotedContext?: QuotedContextItem | null): string => {
    const afterSkills = extractSkills(content).cleanedContent;
    return extractQuoteAndCleanContent(afterSkills, quotedContext || undefined).cleanedContent;
  };

  const parseMessageContent = (content?: string): MessageContentSegment[] => {
    if (!content) return [];
    const segments: MessageContentSegment[] = [];
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mermaidRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const text = content.slice(lastIndex, match.index);
        if (text.trim()) {
          segments.push({ type: 'markdown', content: text });
        }
      }
      const diagramCode = match[1].trim();
      if (diagramCode) {
        segments.push({ type: 'mermaid', content: diagramCode });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const text = content.slice(lastIndex);
      if (text.trim()) {
        segments.push({ type: 'markdown', content: text });
      }
    }

    if (segments.length === 0) {
      return [{ type: 'markdown', content }];
    }

    return segments;
  };

  return {
    containerRef,
    copyText,
    isErrorMessage,
    extractSkills,
    getAttachedSkills,
    extractQuoteAndCleanContent,
    getExtractedQuote,
    getCleanedContent,
    parseMessageContent
  };
}
