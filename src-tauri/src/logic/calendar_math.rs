use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarMonth {
    pub название: String,
    pub дней: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEra {
    pub название: String,
    pub год_начала: i32,
    pub год_конца: i32,
    #[serde(default)]
    pub обратный_отсчет: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomLeapRule {
    pub месяц: i32,
    pub день_смещения: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MoonPhaseNames {
    pub new: String,
    pub waxing: String,
    pub full: String,
    pub waning: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MoonConfig {
    pub name: String,
    pub period_days: f64,
    pub initial_phase: f64,
    pub phase_names: Option<MoonPhaseNames>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncAnchor {
    pub master_calendar_id: Option<String>,
    pub local_absolute_minute: i64,
    pub master_absolute_minute: i64,
    pub linked_to_master: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

pub struct CalendarMath;

impl CalendarMath {
    pub fn is_leap_year(calendar: &CalendarData, year: i32) -> bool {
        let rule = &calendar.leap_year_rule;
        if rule == "григорианское" {
            return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        } else if rule == "каждый 4 год" {
            return year % 4 == 0;
        }
        false
    }

    pub fn get_days_in_year(calendar: &CalendarData, year: i32) -> i32 {
        let mut days = 0;
        for (i, month) in calendar.months.iter().enumerate() {
            let mut m_days = month.дней;
            if let Some(rule) = &calendar.custom_leap_rule {
                if rule.месяц == i as i32 && Self::is_leap_year(calendar, year) {
                    m_days += rule.день_смещения;
                }
            }
            days += m_days;
        }
        days
    }

    #[allow(dead_code)]
    pub fn get_absolute_minute(
        calendar: &CalendarData,
        era_index: usize,
        year: i32,
        month: i32,
        day: i32,
        hour: i32,
        minute: i32,
    ) -> i64 {
        let settings = calendar.time_settings.clone().unwrap_or_default();
        let minutes_in_day = (settings.часов_в_сутках * settings.минут_в_часе) as i64;

        let mut total_days: i64 = 0;

        let era = calendar.eras.get(era_index);
        let is_reverse = era.is_some_and(|e| e.обратный_отсчет);

        let actual_year = if is_reverse { -year } else { year };

        if actual_year > 1 {
            for y in 1..actual_year {
                total_days += Self::get_days_in_year(calendar, y) as i64;
            }
        } else if actual_year < 1 {
            for y in (actual_year..=0).rev() {
                total_days -= Self::get_days_in_year(calendar, y) as i64;
            }
        }

        for m in 0..month {
            let mut m_days = calendar.months[m as usize].дней;
            if let Some(rule) = &calendar.custom_leap_rule {
                if rule.месяц == m && Self::is_leap_year(calendar, actual_year) {
                    m_days += rule.день_смещения;
                }
            }
            total_days += m_days as i64;
        }

        total_days += (day - 1) as i64;

        let mut abs_minute = total_days * minutes_in_day;
        abs_minute += (hour * settings.минут_в_часе) as i64;
        abs_minute += minute as i64;

        abs_minute
    }

    pub fn get_date_from_absolute(
        absolute_minute: i64,
        calendar: &CalendarData,
        era_index: usize,
    ) -> (i32, i32, i32, i32, i32) {
        let settings = calendar.time_settings.clone().unwrap_or_default();
        let minutes_in_day = (settings.часов_в_сутках * settings.минут_в_часе) as i64;

        let mut total_days = absolute_minute / minutes_in_day;
        let mut remainder_minutes = absolute_minute % minutes_in_day;
        if remainder_minutes < 0 {
            remainder_minutes += minutes_in_day;
            total_days -= 1;
        }

        let hour = remainder_minutes / settings.минут_в_часе as i64;
        let minute = remainder_minutes % settings.минут_в_часе as i64;

        let mut year = 1;
        if total_days >= 0 {
            loop {
                let y_days = Self::get_days_in_year(calendar, year) as i64;
                if total_days >= y_days {
                    total_days -= y_days;
                    year += 1;
                } else {
                    break;
                }
            }
        } else {
            year = 0;
            loop {
                let y_days = Self::get_days_in_year(calendar, year) as i64;
                if total_days < 0 {
                    total_days += y_days;
                    year -= 1;
                } else {
                    break;
                }
            }
        }

        let mut month = 0;
        for (m, m_data) in calendar.months.iter().enumerate() {
            let mut m_days = m_data.дней;
            if let Some(rule) = &calendar.custom_leap_rule {
                if rule.месяц == m as i32 && Self::is_leap_year(calendar, year) {
                    m_days += rule.день_смещения;
                }
            }
            if total_days >= m_days as i64 {
                total_days -= m_days as i64;
                month += 1;
            } else {
                break;
            }
        }

        let day = total_days as i32 + 1;

        let era = calendar.eras.get(era_index);
        let is_reverse = era.is_some_and(|e| e.обратный_отсчет);
        if is_reverse {
            year = -year;
        }

        (year, month, day, hour as i32, minute as i32)
    }
}

#[tauri::command]
pub fn convert_absolute_to_local(
    absolute_minute: i64,
    calendar: CalendarData,
    era_index: usize,
) -> serde_json::Value {
    let (year, month, day, hour, minute) =
        CalendarMath::get_date_from_absolute(absolute_minute, &calendar, era_index);

    serde_json::json!({
        "year": year,
        "month": month,
        "day": day,
        "hour": hour,
        "minute": minute
    })
}
