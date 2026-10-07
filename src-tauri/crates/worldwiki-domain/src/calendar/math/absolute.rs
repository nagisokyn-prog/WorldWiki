use super::leap::{get_days_in_year, is_leap_year};
use crate::calendar::models::CalendarData;

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
            total_days += get_days_in_year(calendar, y) as i64;
        }
    } else if actual_year < 1 {
        for y in (actual_year..=0).rev() {
            total_days -= get_days_in_year(calendar, y) as i64;
        }
    }

    for m in 0..month {
        let mut m_days = calendar.months.get(m as usize).map(|x| x.дней).unwrap_or(0);
        if let Some(rule) = &calendar.custom_leap_rule
            && rule.месяц == m
            && is_leap_year(calendar, actual_year)
        {
            m_days += rule.день_смещения;
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
            let y_days = get_days_in_year(calendar, year) as i64;
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
            let y_days = get_days_in_year(calendar, year) as i64;
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
        if let Some(rule) = &calendar.custom_leap_rule
            && rule.месяц == m as i32
            && is_leap_year(calendar, year)
        {
            m_days += rule.день_смещения;
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
