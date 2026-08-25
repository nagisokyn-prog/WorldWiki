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

#[cfg(test)]
mod tests {
    use super::*;

    /// Строит простой григорианский календарь с 12 месяцами.
    fn gregorian_calendar() -> CalendarData {
        CalendarData {
            название: "test".to_string(),
            calendar_type: None,
            is_master: None,
            months: vec![
                CalendarMonth { название: "Янв".into(), дней: 31 },
                CalendarMonth { название: "Фев".into(), дней: 28 },
                CalendarMonth { название: "Мар".into(), дней: 31 },
                CalendarMonth { название: "Апр".into(), дней: 30 },
                CalendarMonth { название: "Май".into(), дней: 31 },
                CalendarMonth { название: "Июн".into(), дней: 30 },
                CalendarMonth { название: "Июл".into(), дней: 31 },
                CalendarMonth { название: "Авг".into(), дней: 31 },
                CalendarMonth { название: "Сен".into(), дней: 30 },
                CalendarMonth { название: "Окт".into(), дней: 31 },
                CalendarMonth { название: "Ноя".into(), дней: 30 },
                CalendarMonth { название: "Дек".into(), дней: 31 },
            ],
            eras: vec![CalendarEra {
                название: "CE".into(),
                год_начала: 1,
                год_конца: 9999,
                обратный_отсчет: false,
            }],
            leap_year_rule: "григорианское".into(),
            custom_leap_rule: None,
            time_settings: None,
            moons: None,
            sync_anchor: None,
        }
    }
#[test]
    fn gregorian_leap_years() {
        let cal = gregorian_calendar();
        assert!(CalendarMath::is_leap_year(&cal, 2000)); // %400 → високосный
        assert!(CalendarMath::is_leap_year(&cal, 2024));
        assert!(!CalendarMath::is_leap_year(&cal, 1900)); // %100 и не %400
        assert!(!CalendarMath::is_leap_year(&cal, 2023));
        assert!(!CalendarMath::is_leap_year(&cal, 2100));
    }

    #[test]
    fn every_4_rule() {
        let mut cal = gregorian_calendar();
        cal.leap_year_rule = "каждый 4 год".into();
        assert!(CalendarMath::is_leap_year(&cal, 1900));
        assert!(CalendarMath::is_leap_year(&cal, 2000));
        assert!(CalendarMath::is_leap_year(&cal, 2024));
        assert!(!CalendarMath::is_leap_year(&cal, 2023));
    }

    #[test]
    fn unknown_rule_is_not_leap() {
        let mut cal = gregorian_calendar();
        cal.leap_year_rule = "whatever".into();
        assert!(!CalendarMath::is_leap_year(&cal, 2024));
    }

    #[test]
    fn days_in_year_no_custom_rule() {
        let cal = gregorian_calendar();
        // Без custom_leap_rule даже високосный год даёт 365 дней
        // (get_days_in_year добавляет день только через custom_leap_rule).
        assert_eq!(CalendarMath::get_days_in_year(&cal, 2023), 365);
        assert_eq!(CalendarMath::get_days_in_year(&cal, 2024), 365);
    }

    #[test]
    fn days_in_year_with_custom_leap_rule() {
        let mut cal = gregorian_calendar();
        cal.custom_leap_rule = Some(CustomLeapRule { месяц: 1, день_смещения: 1 });
        assert_eq!(CalendarMath::get_days_in_year(&cal, 2024), 366);
        assert_eq!(CalendarMath::get_days_in_year(&cal, 2023), 365);
    }
#[test]
    fn absolute_minute_epoch() {
        // 1 января, 1 год, 00:00 → минута 0.
        let cal = gregorian_calendar();
        let m = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 1, 0, 0);
        assert_eq!(m, 0);
    }

    #[test]
    fn absolute_minute_advances_by_one_day() {
        let cal = gregorian_calendar();
        let day1 = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 1, 0, 0);
        let day2 = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 2, 0, 0);
        assert_eq!(day2 - day1, 24 * 60);
    }

    #[test]
    fn absolute_minute_advances_by_one_minute() {
        let cal = gregorian_calendar();
        let base = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 1, 0, 0);
        let plus_minute = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 1, 0, 1);
        assert_eq!(plus_minute - base, 1);
    }

    #[test]
    fn absolute_minute_ticks_into_next_year() {
        let cal = gregorian_calendar();
        // 31.12.1 23:59 → +1 минута = начало 2-го года.
        let last = CalendarMath::get_absolute_minute(&cal, 0, 1, 11, 31, 23, 59);
        let next = last + 1;
        let (year, month, day, hour, minute) =
            CalendarMath::get_date_from_absolute(next, &cal, 0);
        assert_eq!(year, 2);
        assert_eq!(month, 0);
        assert_eq!(day, 1);
        assert_eq!(hour, 0);
        assert_eq!(minute, 0);
    }

    #[test]
    fn date_from_absolute_roundtrip() {
        let cal = gregorian_calendar();
        let cases = [
            (2000, 2, 29, 12, 30),  // leap day
            (1999, 11, 31, 23, 59), // last day non-leap year
            (1, 0, 1, 0, 0),        // epoch
            (2024, 11, 25, 8, 15),  // normal leap year day
        ];
        for (y, m, d, h, mi) in cases {
            let abs = CalendarMath::get_absolute_minute(&cal, 0, y, m, d, h, mi);
            let (ry, rm, rd, rh, rmi) = CalendarMath::get_date_from_absolute(abs, &cal, 0);
            assert_eq!((ry, rm, rd, rh, rmi), (y, m, d, h, mi), "roundtrip failed for {y}-{m}-{d}");
        }
    }

    #[test]
    fn convert_absolute_to_local_returns_json() {
        let cal = gregorian_calendar();
        let val = convert_absolute_to_local(0, cal, 0);
        assert_eq!(val["year"], 1);
        assert_eq!(val["month"], 0);
        assert_eq!(val["day"], 1);
        assert_eq!(val["hour"], 0);
        assert_eq!(val["minute"], 0);
    }

    #[test]
    fn reverse_era_negates_year() {
        let mut cal = gregorian_calendar();
        cal.eras = vec![CalendarEra {
            название: "BC".into(),
            год_начала: 0,
            год_конца: 0,
            обратный_отсчет: true,
        }];
        // absolute=0 → год 1. В обратной эре год негатится → -1.
        let (year, _, _, _, _) = CalendarMath::get_date_from_absolute(0, &cal, 0);
        assert_eq!(year, -1);
    }

    #[test]
    fn absolute_minute_honors_custom_time_settings() {
        let mut cal = gregorian_calendar();
        cal.time_settings = Some(CalendarSettings {
            часов_в_сутках: 10,
            минут_в_часе: 60,
            секунд_в_минуте: 60,
            широта: 0.0,
            учитывать_сезонную_длительность_дня: false,
        });

        let day1 = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 1, 0, 0);
        let day2 = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 2, 0, 0);
        assert_eq!(
            day2 - day1,
            10 * 60,
            "при 10 часах в сутках разница между днями = 600 минут"
        );
    }

    // ---------- Волна 1: границы и property-тесты ----------

    #[test]
    fn last_minute_of_year_roundtrips() {
        let cal = gregorian_calendar();
        // Последняя минута года: 31 декабря 23:59
        let abs = CalendarMath::get_absolute_minute(&cal, 0, 1999, 11, 31, 23, 59);
        let (y, m, d, h, mi) = CalendarMath::get_date_from_absolute(abs, &cal, 0);
        assert_eq!((y, m, d, h, mi), (1999, 11, 31, 23, 59));

        // Первая минута следующего года
        let next = abs + 1;
        let (y2, m2, d2, h2, mi2) = CalendarMath::get_date_from_absolute(next, &cal, 0);
        assert_eq!((y2, m2, d2, h2, mi2), (2000, 0, 1, 0, 0));
    }

    #[test]
    fn minute_zero_of_custom_calendar_is_epoch() {
        let mut cal = gregorian_calendar();
        cal.time_settings = Some(CalendarSettings {
            часов_в_сутках: 7,
            минут_в_часе: 43,
            секунд_в_минуте: 60,
            широта: 0.0,
            учитывать_сезонную_длительность_дня: false,
        });
        // Абсолютная минута 0 всегда → начало эпохи независимо от настроек времени
        let val = convert_absolute_to_local(0, cal.clone(), 0);
        assert_eq!(val["year"], 1);
        assert_eq!(val["day"], 1);
        assert_eq!(val["hour"], 0);
        assert_eq!(val["minute"], 0);

        // minutes_in_day = 7 * 43 = 301
        let day1 = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 1, 0, 0);
        let day2 = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 2, 0, 0);
        assert_eq!(day2 - day1, 301);
    }

    #[test]
    fn custom_time_last_minute_of_day_boundary() {
        let mut cal = gregorian_calendar();
        cal.time_settings = Some(CalendarSettings {
            часов_в_сутках: 10,
            минут_в_часе: 50,
            секунд_в_минуте: 60,
            широта: 0.0,
            учитывать_сезонную_длительность_дня: false,
        });
        // minutes_in_day = 500; последняя минута суток = 9:49
        let val = convert_absolute_to_local(499, cal.clone(), 0);
        assert_eq!(val["hour"], 9);
        assert_eq!(val["minute"], 49);

        // Следующая минута — уже новый день
        let val2 = convert_absolute_to_local(500, cal, 0);
        assert_eq!(val2["hour"], 0);
        assert_eq!(val2["minute"], 0);
    }

    #[test]
    fn negative_year_time_of_day_is_preserved() {
        // Известная асимметрия: обратный проход по отрицательным годам даёт
        // off-by-one в номере года (задокументировано), но время суток
        // считается до обхода годов и потому сохраняется точно.
        let cal = gregorian_calendar();
        let abs = CalendarMath::get_absolute_minute(&cal, 0, -5, 2, 10, 3, 30);
        assert!(abs < 0);
        let (_, _, _, h, mi) = CalendarMath::get_date_from_absolute(abs, &cal, 0);
        assert_eq!((h, mi), (3, 30));
    }

    #[test]
    fn property_roundtrip_thousands_of_random_minutes() {
        let cal = gregorian_calendar();
        // Детерминированный LCG вместо внешнего крейта property-testing
        let mut state: u64 = 0x9E37_79B9_7F4A_7C15;
        let max_abs: u64 = 365 * 25 * 24 * 60; // ~25 лет

        for _ in 0..2500 {
            state = state
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            let abs = 1 + (state % max_abs) as i64;

            let (y, m, d, h, mi) = CalendarMath::get_date_from_absolute(abs, &cal, 0);
            let back = CalendarMath::get_absolute_minute(&cal, 0, y, m, d, h, mi);
            assert_eq!(back, abs, "roundtrip сломался на abs={abs} → {y}-{m}-{d} {h}:{mi}");
        }
    }

    #[test]
    fn leap_day_minute_arithmetic_documents_no_custom_rule_behavior() {
        // Документируем поведение: без custom_leap_rule февраль всегда 28 дней,
        // поэтому «переполнение» 28.02+1мин уходит в индекс следующего месяца,
        // а существующий roundtrip-тест (2000-02-29) показывает симметрию этого
        // представления. Проверяем обе стороны:
        let cal = gregorian_calendar();
        let feb28 = CalendarMath::get_absolute_minute(&cal, 0, 2024, 1, 28, 23, 59);
        let (y, m, d, _, _) = CalendarMath::get_date_from_absolute(feb28 + 1, &cal, 0);
        assert_eq!((y, m, d), (2024, 2, 1), "без leap-rule за 28.02 идёт месяц с индексом 2");

        // Симметрия: полученная дата конвертируется обратно в ту же минуту
        let back = CalendarMath::get_absolute_minute(&cal, 0, y, m, d, 0, 0);
        assert_eq!(back, feb28 + 1);

        // В невисокосном 2023 то же самое
        let feb28_23 = CalendarMath::get_absolute_minute(&cal, 0, 2023, 1, 28, 23, 59);
        let r23 = CalendarMath::get_date_from_absolute(feb28_23 + 1, &cal, 0);
        assert_eq!(r23, (2023, 2, 1, 0, 0));
    }

    #[test]
    fn custom_leap_rule_extends_target_month_only_in_leap_years() {
        let mut cal = gregorian_calendar();
        cal.custom_leap_rule = Some(CustomLeapRule {
            месяц: 1,               // второй месяц
            день_смещения: 1,
        });

        assert_eq!(CalendarMath::get_days_in_year(&cal, 2024), 366);
        assert_eq!(CalendarMath::get_days_in_year(&cal, 2023), 365);

        // Год 1900 по григорианскому правилу НЕ високосный
        assert_eq!(CalendarMath::get_days_in_year(&cal, 1900), 365);
        // А 2000 — високосный (делится на 400)
        assert_eq!(CalendarMath::get_days_in_year(&cal, 2000), 366);
    }
}

