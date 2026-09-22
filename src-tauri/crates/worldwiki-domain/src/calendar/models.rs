use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CalendarMonth {
    #[serde(alias = "name")]
    pub название: String,
    #[serde(alias = "days")]
    pub дней: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CalendarEra {
    #[serde(alias = "name")]
    pub название: String,
    #[serde(default, alias = "start_year")]
    pub год_начала: i32,
    #[serde(default, alias = "end_year")]
    pub год_конца: i32,
    #[serde(default, alias = "is_count_down")]
    pub обратный_отсчет: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CustomLeapRule {
    #[serde(alias = "month")]
    pub месяц: i32,
    #[serde(alias = "day_offset")]
    pub день_смещения: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CalendarSettings {
    #[serde(default = "default_24", alias = "hours_per_day")]
    pub часов_в_сутках: i32,
    #[serde(default = "default_60", alias = "minutes_per_hour")]
    pub минут_в_часе: i32,
    #[serde(default = "default_60", alias = "seconds_per_minute")]
    pub секунд_в_минуте: i32,
    #[serde(default, alias = "latitude")]
    pub широта: f64,
    #[serde(default, alias = "use_seasonal_day_length")]
    pub учитывать_сезонную_длительность_дня: bool,
}

fn default_24() -> i32 { 24 }
fn default_60() -> i32 { 60 }

impl Default for CalendarSettings {
    fn default() -> Self {
        Self {
            часов_в_сутках: 24,
            минут_в_часе: 60,
            секунд_в_минуте: 60,
            широта: 0.0,
            учитывать_сезонную_длительность_дня: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct MoonPhaseNames {
    pub new: String,
    pub waxing: String,
    pub full: String,
    pub waning: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct MoonConfig {
    pub name: String,
    pub period_days: f64,
    pub initial_phase: f64,
    pub phase_names: Option<MoonPhaseNames>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct SyncAnchorDate {
    #[serde(default)]
    pub era_index: usize,
    pub year: i32,
    pub month: i32,
    pub day: i32,
    #[serde(default)]
    pub hour: i32,
    #[serde(default)]
    pub minute: i32,
}

pub type DateCoordinate = SyncAnchorDate;

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct SyncAnchor {
    pub master_calendar_id: Option<String>,
    #[serde(default)]
    pub local_absolute_minute: i64,
    #[serde(default)]
    pub master_absolute_minute: i64,
    #[serde(default)]
    pub linked_to_master: bool,
    pub local_anchor_date: Option<SyncAnchorDate>,
    pub master_anchor_date: Option<SyncAnchorDate>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CalendarData {
    #[serde(alias = "name")]
    pub название: String,
    pub calendar_type: Option<String>,
    pub is_master: Option<bool>,
    #[serde(default, alias = "месяцы")]
    pub months: Vec<CalendarMonth>,
    #[serde(default, alias = "эпохи")]
    pub eras: Vec<CalendarEra>,
    #[serde(default, alias = "правило_високосного_года")]
    pub leap_year_rule: String,
    #[serde(alias = "пользовательское_високосное_правило")]
    pub custom_leap_rule: Option<CustomLeapRule>,
    #[serde(alias = "настройки_времени")]
    pub time_settings: Option<CalendarSettings>,
    pub moons: Option<Vec<MoonConfig>>,
    pub sync_anchor: Option<SyncAnchor>,
}
