extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;

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

/// Режим отсчета номера года эры
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum EraCountingMode {
    #[default]
    ByCalendarYear,
    ByAnniversary,
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
