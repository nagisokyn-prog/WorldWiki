import { ref } from 'vue';

export function useCalendarSeasons(props: any, emit?: any) {
  const isCollapsed = ref(false);

  const moveItem = (idx: number, delta: number) => {
    const arr = props.modelValue.сезоны;
    const n = idx + delta;
    if (n >= 0 && n < arr.length) {
      [arr[idx], arr[n]] = [arr[n], arr[idx]];
    }
  };

  const addSeason = () => {
    if (!props.modelValue.сезоны) props.modelValue.сезоны = [];
    const used = new Set<number>();
    props.modelValue.сезоны.forEach((s: any) => s.месяцы?.forEach((m: number) => used.add(m)));
    const available = (props.modelValue.месяцы || [])
      .map((_: any, i: number) => i)
      .filter((i: number) => !used.has(i));

    props.modelValue.сезоны.push({
      название: `Сезон ${props.modelValue.сезоны.length + 1}`,
      месяцы: available.slice(0, 3),
    });
  };

  const isMonthInSeason = (sIdx: number, mIdx: number) => {
    return props.modelValue.сезоны?.[sIdx]?.месяцы?.includes(mIdx) || false;
  };

  const toggleMonthInSeason = (sIdx: number, mIdx: number) => {
    const season = props.modelValue.сезоны?.[sIdx];
    if (!season) return;
    if (!season.месяцы) season.месяцы = [];

    const pos = season.месяцы.indexOf(mIdx);
    if (pos > -1) {
      season.месяцы.splice(pos, 1);
    } else {
      props.modelValue.сезоны.forEach((s: any, i: number) => {
        if (i !== sIdx && s.месяцы) {
          const p = s.месяцы.indexOf(mIdx);
          if (p > -1) s.месяцы.splice(p, 1);
        }
      });
      season.месяцы.push(mIdx);
      season.месяцы.sort((a: number, b: number) => a - b);
    }
  };

  return {
    isCollapsed,
    moveItem,
    addSeason,
    isMonthInSeason,
    toggleMonthInSeason
  };
}
