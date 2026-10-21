import type { CultureSeasonDto } from '../Tab3CultureLore.model';

export function useTab3SeasonsSection(
  props: { seasons: CultureSeasonDto[]; isReadOnly?: boolean },
  emit: (e: 'update-seasons', list: CultureSeasonDto[]) => void,
) {
  const toggleHemisphere = (s: CultureSeasonDto) => {
    if (props.isReadOnly) return;
    s.hemisphere = s.hemisphere === 'southern' ? 'northern' : 'southern';
    emit('update-seasons', [...props.seasons]);
  };

  const toggleMonthInSeason = (s: CultureSeasonDto, mIdx: number) => {
    if (props.isReadOnly) return;
    const currentMonths = [...(s.месяцы || [])];
    const foundIdx = currentMonths.indexOf(mIdx);
    if (foundIdx >= 0) {
      currentMonths.splice(foundIdx, 1);
    } else {
      currentMonths.push(mIdx);
      currentMonths.sort((a, b) => a - b);
    }
    s.месяцы = currentMonths;
    emit('update-seasons', [...props.seasons]);
  };

  return {
    toggleHemisphere,
    toggleMonthInSeason,
  };
}
