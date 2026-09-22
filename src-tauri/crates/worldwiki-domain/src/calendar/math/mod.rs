pub mod absolute;
pub mod conversion;
pub mod leap;

pub use absolute::{get_absolute_minute, get_date_from_absolute};
pub use conversion::{
    convert_between_calendars, get_anchor_offset, local_to_master_minute,
    master_minute_to_local,
};
pub use leap::{get_days_in_year, is_leap_year};

use crate::calendar::models::{CalendarData, DateCoordinate};

pub struct CalendarMath;

impl CalendarMath {
    pub fn is_leap_year(calendar: &CalendarData, year: i32) -> bool {
        leap::is_leap_year(calendar, year)
    }

    pub fn get_days_in_year(calendar: &CalendarData, year: i32) -> i32 {
        leap::get_days_in_year(calendar, year)
    }

    pub fn get_absolute_minute(
        calendar: &CalendarData,
        era_index: usize,
        year: i32,
        month: i32,
        day: i32,
        hour: i32,
        minute: i32,
    ) -> i64 {
        absolute::get_absolute_minute(calendar, era_index, year, month, day, hour, minute)
    }

    pub fn get_date_from_absolute(
        absolute_minute: i64,
        calendar: &CalendarData,
        era_index: usize,
    ) -> (i32, i32, i32, i32, i32) {
        absolute::get_date_from_absolute(absolute_minute, calendar, era_index)
    }

    pub fn get_anchor_offset(local_cal: &CalendarData, master_cal: Option<&CalendarData>) -> i64 {
        conversion::get_anchor_offset(local_cal, master_cal)
    }

    pub fn local_to_master_minute(
        local_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        date: &DateCoordinate,
    ) -> i64 {
        conversion::local_to_master_minute(local_cal, master_cal, date)
    }

    pub fn master_minute_to_local(
        master_minute: i64,
        local_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        era_index: usize,
    ) -> (i32, i32, i32, i32, i32) {
        conversion::master_minute_to_local(master_minute, local_cal, master_cal, era_index)
    }

    pub fn convert_between_calendars(
        from_cal: &CalendarData,
        to_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        from_date: &DateCoordinate,
        to_era: usize,
    ) -> (i32, i32, i32, i32, i32) {
        conversion::convert_between_calendars(from_cal, to_cal, master_cal, from_date, to_era)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::calendar::models::*;

    fn gregorian_calendar() -> CalendarData {
        CalendarData {
            название: "test".to_string(),
            calendar_type: None,
            is_master: None,
            months: vec![
                CalendarMonth {
                    название: "Янв".into(),
                    дней: 31,
                },
                CalendarMonth {
                    название: "Фев".into(),
                    дней: 28,
                },
                CalendarMonth {
                    название: "Мар".into(),
                    дней: 31,
                },
                CalendarMonth {
                    название: "Апр".into(),
                    дней: 30,
                },
                CalendarMonth {
                    название: "Май".into(),
                    дней: 31,
                },
                CalendarMonth {
                    название: "Июн".into(),
                    дней: 30,
                },
                CalendarMonth {
                    название: "Июл".into(),
                    дней: 31,
                },
                CalendarMonth {
                    название: "Авг".into(),
                    дней: 31,
                },
                CalendarMonth {
                    название: "Сен".into(),
                    дней: 30,
                },
                CalendarMonth {
                    название: "Окт".into(),
                    дней: 31,
                },
                CalendarMonth {
                    название: "Ноя".into(),
                    дней: 30,
                },
                CalendarMonth {
                    название: "Дек".into(),
                    дней: 31,
                },
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
        assert!(CalendarMath::is_leap_year(&cal, 2000));
        assert!(CalendarMath::is_leap_year(&cal, 2024));
        assert!(!CalendarMath::is_leap_year(&cal, 1900));
        assert!(!CalendarMath::is_leap_year(&cal, 2023));
    }

    #[test]
    fn absolute_minute_epoch() {
        let cal = gregorian_calendar();
        let m = CalendarMath::get_absolute_minute(&cal, 0, 1, 0, 1, 0, 0);
        assert_eq!(m, 0);
    }
}
