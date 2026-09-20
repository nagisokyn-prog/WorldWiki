import { describe, it, expect } from 'vitest';
import { useAiResearchProgress } from '../useAiResearchProgress';

describe('useAiResearchProgress', () => {
  it('computes correct stage labels', () => {
    expect(useAiResearchProgress({ stage: 'planning' }).stageLabel.value).toBe('Формирование плана исследования...');
    expect(useAiResearchProgress({ stage: 'searching', query: 'Артас' }).stageLabel.value).toBe('Поиск: «Артас»');
    expect(useAiResearchProgress({ stage: 'searching' }).stageLabel.value).toBe('Поиск источников...');
    expect(useAiResearchProgress({ stage: 'reading' }).stageLabel.value).toBe('Чтение и анализ страниц...');
    expect(useAiResearchProgress({ stage: 'synthesizing' }).stageLabel.value).toBe('Синтез ответа и проверка цитат...');
    expect(useAiResearchProgress({ stage: 'completed' }).stageLabel.value).toBe('Исследование завершено');
    expect(useAiResearchProgress({ stage: 'idle' }).stageLabel.value).toBe('');
  });
});
