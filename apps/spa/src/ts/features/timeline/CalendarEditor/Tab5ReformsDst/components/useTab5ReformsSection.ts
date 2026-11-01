import { computed } from 'vue';
import type { Tab5ReformsSectionProps } from './Tab5ReformsSection.model';
import type { ReformMode } from '../Tab5ReformsDst.model';

export const MODE_CARDS = [
  {
    mode: 'gap' as ReformMode,
    icon: '🕳️',
    title: 'Выброшенные дни (Gap)',
    desc: 'Скачок дат без разрыва дней недели. Например, после четверга 4 октября сразу пятница 15 октября.',
  },
  {
    mode: 'transitional' as ReformMode,
    icon: '⏳',
    title: 'Переходный год (Transitional)',
    desc: 'Один конкретный год удлиняется или сокращается интеркалярными месяцами/днями.',
  },
  {
    mode: 'reset' as ReformMode,
    icon: '🔄',
    title: 'Новая Эра (EpochReset)',
    desc: 'В момент реформы номер года обнуляется (Год 1 Новой Эры), привязываясь к M_abs.',
  },
] as const;

export function useTab5ReformsSection(props: Tab5ReformsSectionProps) {
  const monthOptions = computed(() =>
    props.monthNames.map((m, i) => ({
      value: String(i + 1),
      label: `${i + 1}. ${m}`,
    }))
  );

  const modeCards = MODE_CARDS;

  return {
    monthOptions,
    modeCards,
  };
}
