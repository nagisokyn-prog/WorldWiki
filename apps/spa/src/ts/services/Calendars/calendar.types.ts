export interface CalendarDate {
  absolute_minute: number;
  calendar_id: string;
  original_input: {
    era_index: number;
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    timezone_key?: string;
  };
}

export interface CalendarMonth {
  название: string;
  дней: number;
}

export interface CalendarEra {
  название: string;
  год_начала: number;
  год_конца: number;
  обратный_отсчет?: boolean;
}

export interface CalendarSeason {
  название: string;
  месяцы: number[];
}

export interface CalendarHoliday {
  название: string;
  дата_начала: { месяц: number; день: number };
  дата_конца?: { месяц: number; день: number };
}

export interface CalendarSettings {
  часов_в_сутках: number;
  минут_в_часе: number;
  секунд_в_минуте: number;
  широта: number;
  учитывать_сезонную_длительность_дня: boolean;
}

export interface MoonPhaseNames {
  new: string;
  waxing: string;
  full: string;
  waning: string;
}

export interface MoonConfig {
  name: string;
  period_days: number;
  initial_phase: number;
  phase_names?: MoonPhaseNames;
}

export interface MoonPhaseResult {
  moon: MoonConfig;
  phase: number;
  name: string;
  emoji: string;
  dayInCycle: number;
}

export interface DaylightResult {
  sunrise: string;
  sunset: string;
  zenith: string;
  duration_hours: number;
}

export interface WeatherPattern {
  id: string;
  name: string;
  season_index: number;
  temp_min: number;
  temp_max: number;
  precipitation: string;
  description: string;
}

export interface SyncAnchorDate {
  era_index: number;
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

export interface SyncAnchor {
  master_calendar_id?: string;
  linked_to_master: boolean;
  local_anchor_date?: SyncAnchorDate;
  master_anchor_date?: SyncAnchorDate;
  local_absolute_minute?: number;
  master_absolute_minute?: number;
}

export interface CalendarData {
  _id?: string;
  название: string;
  calendar_type?: 'master' | 'local';
  is_master?: boolean;
  дней_в_неделе: number;
  названия_дней_недели: string[];
  первый_месяц_года: number;
  месяцы: CalendarMonth[];
  эпохи: CalendarEra[];
  правило_високосного_года: string;
  пользовательское_високосное_правило?: { месяц: number; день_смещения: number };
  точка_отсчета?: { эпоха?: number; год: number; месяц: number; день: number; день_недели: number };
  настройки_времени?: CalendarSettings;
  сезоны?: CalendarSeason[];
  праздники?: CalendarHoliday[];
  
  sync_anchor?: SyncAnchor;
  timezone_regions?: Array<{
    id: string;
    name: string;
    offset_minutes: number;
  }>;
  moons?: MoonConfig[];
  day_length_anchor?: {
    summer_solstice_hours: number;
    winter_solstice_hours: number;
  };
  timezones?: WorldTimezone[];
  regions?: WorldRegion[];
  default_region_id?: string;
  default_timezone_id?: string;
  
  [key: string]: unknown;
}

/** Физический инвариант момента времени планеты (Мировые сутки + Доля дня) */
export interface WorldMoment {
  day_index: number;
  day_fraction: number; // [0.0, 1.0)
}

/** Историческое правило часового пояса на шкале мировых суток */
export interface HistoricalTimezoneRule {
  start_world_day?: number | null;
  end_world_day?: number | null;
  offset_hours: number;
  description?: string;
}

/** Часовой пояс мира (долготный сдвиг относительно нулевого меридиана) */
export interface WorldTimezone {
  id: string;
  name: string;
  code?: string;
  base_offset_hours: number;
  historical_rules?: HistoricalTimezoneRule[];
}

/** Географический регион планеты */
export interface WorldRegion {
  id: string;
  name: string;
  timezone_id: string;
  latitude: number;  // Широта (-90 .. +90): управляет сезонами и длиной дня
  longitude: number; // Долгота (-180 .. +180): управляет солнечным полуднем
}

/** Астрономическое состояние солнца в регионе для писателя */
export interface RegionSunStatus {
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  phase_label: string;
  daylight_text: string;
  sunrise_time: string;
  sunset_time: string;
  zenith_time: string;
  note?: string;
}

export interface LoreDateExplanation {
  masterDateFormatted: string;
  localDateFormatted: string;
  crossDates: Array<{ calendarName: string; formatted: string }>;
  moons: MoonPhaseResult[];
  daylightText?: string;
  sunriseText?: string;
  sunsetText?: string;
  holidays: string[];
  snippet: string;
}
