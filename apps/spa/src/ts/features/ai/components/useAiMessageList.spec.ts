import { describe, it, expect } from 'vitest';
import { useAiMessageList } from './useAiMessageList';

describe('useAiMessageList', () => {
  it('identifies error messages correctly', () => {
    const { isErrorMessage } = useAiMessageList();
    expect(isErrorMessage('🚫 Ошибка')).toBe(true);
    expect(isErrorMessage('⚠️ Предупреждение')).toBe(true);
    expect(isErrorMessage('Обычный текст')).toBe(false);
    expect(isErrorMessage('')).toBe(false);
  });

  it('parses plain markdown without mermaid as single segment', () => {
    const { parseMessageContent } = useAiMessageList();
    const result = parseMessageContent('Привет мир');
    expect(result).toEqual([{ type: 'markdown', content: 'Привет мир' }]);
  });

  it('parses mermaid code blocks into structured segments', () => {
    const { parseMessageContent } = useAiMessageList();
    const text = 'Вот диаграмма:\n```mermaid\nflowchart TD\nA --> B\n```\nКонец описания.';
    const result = parseMessageContent(text);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ type: 'markdown', content: 'Вот диаграмма:\n' });
    expect(result[1]).toEqual({ type: 'mermaid', content: 'flowchart TD\nA --> B' });
    expect(result[2]).toEqual({ type: 'markdown', content: '\nКонец описания.' });
  });
});
