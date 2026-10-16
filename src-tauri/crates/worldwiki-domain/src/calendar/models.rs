use serde::{Deserialize, Serialize};
use worldwiki_calendar_core::{
    self as core, CoreEra, DialHierarchy, DialUnit, EraCountingMode, LeapHarmonic, LeapTarget,
};

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

fn default_24() -> i32 {
    24
}
fn default_60() -> i32 {
    60
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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct DialUnitModel {
    pub name: String,
    pub subdivisions: i64,
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
    #[serde(default)]
    pub planet_id: Option<String>,
    #[serde(default)]
    pub ticks_per_day: Option<i64>,
    #[serde(default)]
    pub day_start_offset: Option<i64>,
    #[serde(default)]
    pub retrograde: Option<bool>,
    #[serde(default)]
    pub dial_hierarchy: Option<Vec<DialUnitModel>>,
}

impl CalendarData {
    pub fn get_harmonics(&self) -> Vec<LeapHarmonic> {
        let rule = self.leap_year_rule.as_str();
        if rule == "григорианское" || rule == "gregorian" {
            vec![
                LeapHarmonic {
                    weight: 1,
                    multiplier_a: 1,
                    shift_b: 0,
                    divisor_c: 4,
                },
                LeapHarmonic {
                    weight: -1,
                    multiplier_a: 1,
                    shift_b: 0,
                    divisor_c: 100,
                },
                LeapHarmonic {
                    weight: 1,
                    multiplier_a: 1,
                    shift_b: 0,
                    divisor_c: 400,
                },
            ]
        } else if rule == "каждый 4 год" || rule == "julian" {
            vec![LeapHarmonic {
                weight: 1,
                multiplier_a: 1,
                shift_b: 0,
                divisor_c: 4,
            }]
        } else {
            Vec::new()
        }
    }

    pub fn get_base_days(&self) -> i64 {
        let sum: i32 = self.months.iter().map(|m| m.дней).sum();
        if sum > 0 {
            sum as i64
        } else {
            365
        }
    }

    pub fn get_leap_offset(&self) -> i64 {
        self.custom_leap_rule
            .as_ref()
            .map(|r| r.день_смещения as i64)
            .unwrap_or(1)
    }

    pub fn to_core_config<'a>(
        &'a self,
        harmonics_buf: &'a mut Vec<LeapHarmonic>,
        months_buf: &'a mut Vec<i32>,
        eras_buf: &'a mut Vec<CoreEra>,
        dial_buf: &'a mut DialHierarchy,
    ) -> core::CalendarCultureConfig<'a> {
        *harmonics_buf = self.get_harmonics();
        *months_buf = self.months.iter().map(|m| m.дней).collect();

        *eras_buf = self
            .eras
            .iter()
            .map(|e| CoreEra {
                name: e.название.clone(),
                start_year: e.год_начала as i64,
                start_month: None,
                start_day: None,
                end_year: if e.год_конца > 0 {
                    Some(e.год_конца as i64)
                } else {
                    None
                },
                end_month: None,
                end_day: None,
                is_count_down: e.обратный_отсчет,
                counting_mode: EraCountingMode::ByCalendarYear,
                priority: 0,
            })
            .collect();

        if let Some(custom_dial) = &self.dial_hierarchy {
            *dial_buf = DialHierarchy {
                units: custom_dial
                    .iter()
                    .map(|u| DialUnit {
                        name: u.name.clone(),
                        subdivisions: u.subdivisions.max(1),
                    })
                    .collect(),
            };
        } else {
            let settings = self.time_settings.clone().unwrap_or_default();
            let hours = settings.часов_в_сутках.max(1) as i64;
            let minutes = settings.минут_в_часе.max(1) as i64;

            *dial_buf = DialHierarchy {
                units: vec![
                    DialUnit {
                        name: String::from("Hour"),
                        subdivisions: hours,
                    },
                    DialUnit {
                        name: String::from("Minute"),
                        subdivisions: minutes,
                    },
                ],
            };
        }

        let ticks_per_day = self
            .ticks_per_day
            .unwrap_or_else(|| core::total_dial_subdivisions(dial_buf));

        let planet_id = self.planet_id.as_deref().unwrap_or("default");
        let day_start_offset = self.day_start_offset.unwrap_or(0);

        let leap_target = if let Some(rule) = &self.custom_leap_rule {
            LeapTarget::InMonth {
                target_month: rule.месяц.max(0) as usize,
            }
        } else if months_buf.len() > 1 {
            LeapTarget::InMonth { target_month: 1 }
        } else {
            LeapTarget::InExtraDays
        };

        core::CalendarCultureConfig {
            planet_id,
            ticks_per_day,
            day_start_offset,
            base_year_days: self.get_base_days(),
            regular_months: months_buf.as_slice(),
            harmonics: harmonics_buf.as_slice(),
            leap_target,
            leap_day_offset: self.get_leap_offset(),
            calendar_origin_day: 0,
            dial: dial_buf,
            eras: eras_buf.as_slice(),
        }
    }
}
