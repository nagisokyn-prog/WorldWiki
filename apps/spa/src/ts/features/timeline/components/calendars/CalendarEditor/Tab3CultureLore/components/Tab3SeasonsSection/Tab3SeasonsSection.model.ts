import type { CalendarMonth } from '@/services/Calendars/calendar.types';
import type { CultureSeasonDto } from '../../Tab3CultureLore.model';

export interface SeasonPaletteItem {
  id: string;
  name: string;
  cssVar: string;
}

export const SEASON_PALETTES: SeasonPaletteItem[] = [
  { id: 'winter', name: 'Зима (Лазурный)', cssVar: 'var(--accent-primary)' },
  { id: 'spring', name: 'Весна (Изумрудный)', cssVar: 'var(--accent-success)' },
  { id: 'summer', name: 'Лето (Янтарный)', cssVar: 'var(--accent-warning)' },
  { id: 'autumn', name: 'Осень (Багряный)', cssVar: 'var(--accent-danger)' },
  { id: 'mystic', name: 'Фиолетовый', cssVar: 'var(--accent)' },
];

export interface Tab3SeasonsSectionProps {
  seasons: CultureSeasonDto[];
  months: CalendarMonth[];
  isReadOnly?: boolean;
}

export type Tab3SeasonsSectionEmits = {
  (e: 'add-season'): void;
  (e: 'update-seasons', list: CultureSeasonDto[]): void;
  (e: 'remove-season', idx: number): void;
};
