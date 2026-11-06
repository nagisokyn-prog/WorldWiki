import type { CharacterAgeRuleDto } from '../../Tab3CultureLore.model';

export interface Tab3AgeTimezoneSectionProps {
  ageRule: CharacterAgeRuleDto;
  calendarTimezone: string;
  regionsList: { id: string; name: string }[];
  selectedRegions: string[];
  timezonesList?: { value: string; label: string }[];
  isReadOnly?: boolean;
}

export type Tab3AgeTimezoneSectionEmits = {
  (e: 'update-age-rule', patch: Partial<CharacterAgeRuleDto>): void;
  (e: 'set-calendar-timezone', tz: string): void;
  (e: 'toggle-region', id: string): void;
  (e: 'add-region', name: string): void;
};
