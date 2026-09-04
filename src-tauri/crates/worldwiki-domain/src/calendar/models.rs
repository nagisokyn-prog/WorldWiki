use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CalendarMonth {
    pub название: String,
    pub дней: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CalendarEra {
    pub название: String,
    pub год_начала: i32,
    pub год_конца: i32,
    #[serde(default)]
    pub обратный_отсчет: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CustomLeapRule {
    pub месяц: i32,
    pub день_смещения: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CalendarSettings {
    pub часов_в_сутках: i32,
    pub минут_в_часе: i32,
    pub секунд_в_минуте: i32,
    pub широта: f64,
    pub учитывать_сезонную_длительность_дня: bool,
}

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
    pub название: String,
    pub calendar_type: Option<String>,
    pub is_master: Option<bool>,
    #[serde(alias = "месяцы")]
    pub months: Vec<CalendarMonth>,
    #[serde(alias = "эпохи")]
    pub eras: Vec<CalendarEra>,
    #[serde(alias = "правило_високосного_года")]
    pub leap_year_rule: String,
    #[serde(alias = "пользовательское_високосное_правило")]
    pub custom_leap_rule: Option<CustomLeapRule>,
    #[serde(alias = "настройки_времени")]
    pub time_settings: Option<CalendarSettings>,
    pub moons: Option<Vec<MoonConfig>>,
    pub sync_anchor: Option<SyncAnchor>,
}
