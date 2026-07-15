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

export interface CalendarData {
  _id?: string;
  название: string;
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
  
  sync_anchor?: {
    this_absolute_minute: number;
    linked_to_master: boolean;
  };
  timezone_regions?: Array<{
    key: string;
    name: string;
    offset_minutes: number;
  }>;
  moons?: MoonConfig[];
  day_length_anchor?: {
    summer_solstice_hours: number;
    winter_solstice_hours: number;
  };
  weather_patterns?: WeatherPattern[];
  
  [key: string]: unknown;
}
