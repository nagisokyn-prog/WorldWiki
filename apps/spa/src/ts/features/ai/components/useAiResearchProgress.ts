import { computed } from 'vue';
import type { AiResearchProgressProps } from './AiResearchProgress.model';

export function useAiResearchProgress(props: AiResearchProgressProps) {
  const stageLabel = computed(() => {
    switch (props.stage) {
      case 'planning':
        return 'Формирование плана исследования...';
      case 'searching':
        return props.query ? `Поиск: «${props.query}»` : 'Поиск источников...';
      case 'reading':
        return 'Чтение и анализ страниц...';
      case 'synthesizing':
        return 'Синтез ответа и проверка цитат...';
      case 'completed':
        return 'Исследование завершено';
      default:
        return '';
    }
  });

  return {
    stageLabel
  };
}
