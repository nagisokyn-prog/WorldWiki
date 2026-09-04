use super::models::CalendarData;

pub struct CalendarMath;

impl CalendarMath {
    pub fn is_leap_year(calendar: &CalendarData, year: i32) -> bool {
        let rule = &calendar.leap_year_rule;
        if rule == "григорианское" {
            (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
        } else if rule == "каждый 4 год" {
            year % 4 == 0
        } else {
            false
        }
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

    pub fn get_anchor_offset(local_cal: &CalendarData, master_cal: Option<&CalendarData>) -> i64 {
        if local_cal.is_master.unwrap_or(false) {
            return 0;
        }
        if let Some(anchor) = &local_cal.sync_anchor {
            if !anchor.linked_to_master {
                return 0;
            }
            if let (Some(loc_date), Some(mst_date), Some(mst_cal)) = (
                &anchor.local_anchor_date,
                &anchor.master_anchor_date,
                master_cal,
            ) {
                let local_min = Self::get_absolute_minute(
                    local_cal,
                    loc_date.era_index,
                    loc_date.year,
                    loc_date.month,
                    loc_date.day,
                    loc_date.hour,
                    loc_date.minute,
                );
                let master_min = Self::get_absolute_minute(
                    mst_cal,
                    mst_date.era_index,
                    mst_date.year,
                    mst_date.month,
                    mst_date.day,
                    mst_date.hour,
                    mst_date.minute,
                );
                return master_min - local_min;
            }
            if anchor.master_absolute_minute != 0 || anchor.local_absolute_minute != 0 {
                return anchor.master_absolute_minute - anchor.local_absolute_minute;
            }
        }
        0
    }

    #[allow(clippy::too_many_arguments)]
    pub fn local_to_master_minute(
        local_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        era_index: usize,
        year: i32,
        month: i32,
        day: i32,
        hour: i32,
        minute: i32,
    ) -> i64 {
        let local_min =
            Self::get_absolute_minute(local_cal, era_index, year, month, day, hour, minute);
        let offset = Self::get_anchor_offset(local_cal, master_cal);
        local_min + offset
    }

    pub fn master_minute_to_local(
        master_minute: i64,
        local_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        era_index: usize,
    ) -> (i32, i32, i32, i32, i32) {
        let offset = Self::get_anchor_offset(local_cal, master_cal);
        let local_min = master_minute - offset;
        Self::get_date_from_absolute(local_min, local_cal, era_index)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn convert_between_calendars(
        from_cal: &CalendarData,
        to_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        from_era: usize,
        year: i32,
        month: i32,
        day: i32,
        hour: i32,
        minute: i32,
        to_era: usize,
    ) -> (i32, i32, i32, i32, i32) {
        let master_min = Self::local_to_master_minute(
            from_cal, master_cal, from_era, year, month, day, hour, minute,
        );
        Self::master_minute_to_local(master_min, to_cal, master_cal, to_era)
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
