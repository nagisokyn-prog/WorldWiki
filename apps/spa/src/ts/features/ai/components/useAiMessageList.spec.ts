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

  it('extracts skill context tags and cleans user message content', () => {
    const { extractSkills, getAttachedSkills, getCleanedContent } = useAiMessageList();
    const raw = `<context type="skill" name="Конструктор типов сущностей">
# Навык: Конструктор типов сущностей
Инструкция...
</context>

!"Конструктор типов сущностей" 

привет. я разраб и тестирую функции своего приложения. ты инструкцию видишь?`;

    const { skills, cleanedContent } = extractSkills(raw);
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('Конструктор типов сущностей');
    expect(skills[0].content).toContain('# Навык: Конструктор типов сущностей');

    expect(cleanedContent).toBe('привет. я разраб и тестирую функции своего приложения. ты инструкцию видишь?');
    expect(getAttachedSkills(raw).length).toBe(1);
    expect(getCleanedContent(raw)).toBe('привет. я разраб и тестирую функции своего приложения. ты инструкцию видишь?');
  });

  it('handles standalone exclamation skill prefix', () => {
    const { getAttachedSkills, getCleanedContent } = useAiMessageList();
    const text = '!"Аналитик сюжета" Проверь дыры в главе 5';
    const skills = getAttachedSkills(text);
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('Аналитик сюжета');
    expect(getCleanedContent(text)).toBe('Проверь дыры в главе 5');
  });
});
