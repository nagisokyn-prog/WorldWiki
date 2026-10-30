import type { CalendarPreset } from './presets.model';
import { russiaModernPreset } from './russia_modern.preset';
import { russiaJulianPreset } from './russia_julian.preset';
import { usaPreset } from './usa.preset';
import { chinaPreset } from './china.preset';
import { japanPreset } from './japan.preset';
import { koreaPreset } from './korea.preset';
import { europePreset } from './europe.preset';
import { shireTolkienPreset } from './shire_tolkien.preset';
import { harptosFaerunPreset } from './harptos_faerun.preset';
import { westerosMartinPreset } from './westeros_martin.preset';

export * from './presets.model';

export const CALENDAR_PRESETS: CalendarPreset[] = [
  // Реальный мир
  russiaModernPreset,
  russiaJulianPreset,
  usaPreset,
  chinaPreset,
  japanPreset,
  koreaPreset,
  europePreset,

  // Фэнтези
  shireTolkienPreset,
  harptosFaerunPreset,
  westerosMartinPreset
];

export function getCalendarPresetById(id: string): CalendarPreset | undefined {
  return CALENDAR_PRESETS.find((p) => p.id === id);
}

