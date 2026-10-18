export interface LocalMoment {
  planet_id: string;
  world_day: number;
  day_tick: number;
}

export interface DialUnit {
  name: string;
  subdivisions: number;
}

export interface DialHierarchy {
  units: DialUnit[];
}

export interface LeapHarmonic {
  weight: number;
  multiplier_a: number;
  shift_b: number;
  divisor_c: number;
}

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
  name?: string;
  год_начала: number;
  год_конца: number;
  обратный_отсчет?: boolean;
  [key: string]: unknown;
}

export interface CalendarSeason {
  название: string;
  месяцы: number[];
  цвет?: string;
  color?: string;
  hemisphere?: 'northern' | 'southern';
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
  period_days?: number;
  initial_phase?: number;
  phase_names?: MoonPhaseNames;
  period_days_num?: number;
  period_days_den?: number;
  initial_phase_bp?: number;
}

export interface MoonPhaseResult {
  moon: MoonConfig;
  phase: number;
  name: string;
  phaseName?: string;
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

export interface CalendarAnchorEvent {
  id: string;
  name: string;
  year: number;
  month?: number;
  day?: number;
  description?: string;
}

export interface SyncAnchor {
  master_calendar_id?: string;
  linked_to_master: boolean;
  sync_type?: 'event' | 'calendar';
  target_event_id?: string;
  target_calendar_id?: string;
  target_calendar_year?: number;
  offset_direction?: 'after' | 'before';
  offset_years?: number;
  local_anchor_date?: SyncAnchorDate;
  master_anchor_date?: SyncAnchorDate;
  local_absolute_minute?: number;
  master_absolute_minute?: number;
}

export interface PlanetEntity {
  id: string;              // "earth", "mars"
  project_id: string;
  name: string;            // "Земля", "Марс"
  ticks_per_day: number;   // Физические сутки (86_400 или 1440)
  orbit_days: number;      // 365.2422 (длина года)
  axial_tilt?: number;     // 23.44 (наклон оси)
  is_retrograde?: boolean; // Прямое или обратное вращение
  solstice_world_day?: number; // День зимнего солнцестояния на физической оси мира (в сутках)
  moons?: MoonConfig[];    // Луны с периодами
  timezones?: WorldTimezone[];
  regions?: WorldRegion[];
}

export interface AgeRule {
  age_at_birth: number;
  step_on_new_year: boolean;
  year_only: boolean;
}

export interface ExtraDaysConfig {
  base_days: number;
  leap_days: number;
  pause_weekdays: boolean;
  name: string;
  target_mode: 'in_month' | 'in_extra_days';
  target_month_index?: number;
  placement?: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month';
  after_month_index?: number;
  day_names?: string[];
}

export interface CalendarData {
  _id?: string;
  project_id?: string;
  planet_id?: string; // 👈 Связь с физической планетой
  название: string;
  calendar_type?: 'master' | 'local';
  is_master?: boolean;
  is_story_origin?: boolean;

  // Циферблат и смещение суток
  dial_hierarchy?: DialHierarchy;
  day_start_offset?: number;

  // Месяцы и недели
  дней_в_неделе: number;
  названия_дней_недели: string[];
  первый_месяц_года: number;
  месяцы: CalendarMonth[];
  эпохи: CalendarEra[];

  // Дни вне месяцев (Праздники)
  extra_days?: number;
  extra_day_names?: string[];
  pause_weekdays_on_extra_days?: boolean;
  extra_days_config?: ExtraDaysConfig;
  epagomenal_config?: {
    extra_days_base: number;
    extra_days_leap: number;
    pause_on_extra_days: boolean;
    name: string;
  };

  // Правила високосов
  правило_високосного_года?: string;
  пользовательское_високосное_правило?: { месяц: number; день_смещения: number; период?: number };
  високосные_правила?: LeapHarmonic[];

  // Точка отсчета
  точка_отсчета?: { эпоха?: number; год: number; месяц: number; день: number; день_недели: number };

  // Сезоны и праздники
  сезоны?: CalendarSeason[];
  праздники?: CalendarHoliday[];

  // Возраст персонажей культуры
  age_rule?: AgeRule;

  // Сопряжение и опорные события
  sync_anchor?: SyncAnchor;
  anchor_events?: CalendarAnchorEvent[];

  default_region_id?: string;
  default_timezone_id?: string;
  region_ids?: string[];
  timezone_ids?: string[];

  // Поля обратной совместимости
  настройки_времени?: CalendarSettings;
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
  summer_day_hours?: number; // Макс. часы света летом
  winter_day_hours?: number; // Мин. часы света зимой
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
