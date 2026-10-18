extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;

/// Типобезопасный идентификатор планеты (п. 14.1)
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct PlanetId(pub String);

impl PlanetId {
    pub fn new(id: impl Into<String>) -> Result<Self, &'static str> {
        let s = id.into();
        if s.trim().is_empty() {
            return Err("PlanetId cannot be empty");
        }
        Ok(Self(s))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl core::ops::Deref for PlanetId {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Типобезопасный идентификатор календаря (п. 14.1)
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CalendarId(pub String);

impl CalendarId {
    pub fn new(id: impl Into<String>) -> Result<Self, &'static str> {
        let s = id.into();
        if s.trim().is_empty() {
            return Err("CalendarId cannot be empty");
        }
        Ok(Self(s))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl core::ops::Deref for CalendarId {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Компактный идентификатор планеты в горячем пути расчетов (без аллокаций строк)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct PlanetKey(pub u32);

/// Локальный момент физических суток на планете
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct LocalMoment {
    pub planet_id: String,
    pub world_day: i64,
    pub day_tick: i64,
}

/// Легковесный локальный момент для горячего пути (Zero-Allocation, Copy, 24 байта)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct FastLocalMoment {
    pub planet_key: PlanetKey,
    pub world_day: i64,
    pub day_tick: i64,
}

/// Единица произвольного деления суток (от старшей к младшей)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct DialUnit {
    pub name: String,
    pub subdivisions: i64,
}

/// Иерархия циферблата культуры
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct DialHierarchy {
    pub units: Vec<DialUnit>,
}

/// Гармоника високосности: w * floor_div(a * Y + b, c)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct LeapHarmonic {
    pub weight: i32,
    pub multiplier_a: i64,
    pub shift_b: i64,
    pub divisor_c: i64,
}

/// Направление високосной добавки
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum LeapTarget {
    InMonth { target_month: usize },
    #[default]
    InExtraDays,
}

/// Конфигурация високосных правил
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct LeapRuleConfig {
    pub harmonics: Vec<LeapHarmonic>,
    pub days_offset: i32,
    pub target: LeapTarget,
}

/// Физический диапазон времени сцены [start, end) в абсолютных тиках t_abs
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct TimeInterval {
    pub start: i64,
    pub end: i64,
}

/// Уровень точности указания даты
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum PrecisionLevel {
    #[default]
    ExactTick,
    Minute,
    Hour,
    Day,
    Month,
    Year,
    Unknown,
}

/// Режим отсчета номера года эры (п. 14.5)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum EraCountingMode {
    #[default]
    ByCalendarYear,
    ByAnniversary,
    #[cfg_attr(feature = "serde", serde(other))]
    Unknown,
}

/// Хронологическая эра для бинарного поиска
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CoreEra {
    pub name: String,
    pub start_year: i64,
    pub start_month: Option<usize>,
    pub start_day: Option<i64>,
    pub end_year: Option<i64>,
    pub end_month: Option<usize>,
    pub end_day: Option<i64>,
    pub is_count_down: bool,
    pub counting_mode: EraCountingMode,
    #[cfg_attr(feature = "serde", serde(default))]
    pub priority: i32,
}

/// Параметрическое правило возраста
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct AgeRule {
    pub age_at_birth: i32,
    pub step_on_new_year: bool,
    pub year_only: bool,
}

/// Точка отсчета календаря
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CalendarOrigin {
    pub year: i64,
    pub month: usize,
    pub day: i64,
    pub weekday: usize,
}

/// Календарная дата культуры для межпланетного преобразования
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct DateCoordinate {
    pub era_index: usize,
    pub year: i64,
    pub month: usize,
    pub day: i64,
    pub unit_values: Vec<i64>,
}

/// Календарная дата года, месяца и дня (без времени и эры)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CalDate {
    pub year: i64,
    pub month: usize,
    pub day: i64,
}

impl CalDate {
    pub const fn new(year: i64, month: usize, day: i64) -> Self {
        Self { year, month, day }
    }
}

/// Валидация уникальности имен дней недели (п. 14.2)
pub fn validate_unique_weekdays(weekdays: &[String]) -> Result<(), &'static str> {
    for (i, name) in weekdays.iter().enumerate() {
        for other in weekdays.iter().skip(i + 1) {
            if name == other {
                return Err("Duplicate weekday name found");
            }
        }
    }
    Ok(())
}

/// Санитизация списка лун при удалении сиротских записей (п. 14.3)
pub fn sanitize_moon_ids(active_moon_ids: &[&str], configured_moons: &mut Vec<String>) {
    configured_moons.retain(|moon_id| active_moon_ids.contains(&moon_id.as_str()));
}

/// Характер перехода при смене календаря (календарной реформе)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum ReformMode {
    /// Мгновенный скачок со швом (выбрасывает или дублирует N дней, напр. Россия 1918: 31 янв -> 14 фев)
    DiscontinuousGap { dropped_days: i32 },
    /// Переходный год нестандартной длины (напр. 445 дней в 46 г. до н.э.)
    TransitionalYear { intercalary_days_added: i32 },
    /// Смена эпохи с сохранением непрерывности счета дней
    EpochReset { new_era_name: String },
}

/// Эпоха действия конкретного календаря в культуре или государстве
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CalendarStyleEra {
    pub calendar_id: String,
    pub effective_from_m_abs: i64,
    pub effective_to_m_abs: Option<i64>,
    pub reform_mode: ReformMode,
}

/// Хронологическая цепочка использования стилей (календарей) культурой
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CalendarSuccession {
    pub eras: Vec<CalendarStyleEra>,
}

/// Порядковый номер вхождения дня недели в месяце
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum WeekdayOccurrence {
    First,
    Second,
    Third,
    Fourth,
    Last,
}

/// Относительное правило дня недели для сезонного перевода часов
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct WeekdayRule {
    pub occurrence: WeekdayOccurrence,
    pub weekday: usize,
    pub month: usize,
    pub minute_of_day: i32,
}

/// Политика сезонного перевода времени (DST) для часового пояса
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum DstPolicy {
    #[default]
    None,
    FixedCalendarDate {
        spring_month: usize,
        spring_day: i64,
        fall_month: usize,
        fall_day: i64,
        shift_minutes: i32,
    },
    RelativeWeekday {
        spring_rule: WeekdayRule,
        fall_rule: WeekdayRule,
        shift_minutes: i32,
    },
}

/// Описание часового пояса планеты с поддержкой сезонного перевода стрелок
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct PlanetTimezone {
    pub id: String,
    pub name: String,
    pub code: String,
    pub standard_offset_minutes: i32,
    pub dst_policy: DstPolicy,
}

