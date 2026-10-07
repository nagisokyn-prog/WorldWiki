use crate::calendar::models::CalendarData;

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
        if let Some(rule) = &calendar.custom_leap_rule
            && rule.месяц == i as i32
            && is_leap_year(calendar, year)
        {
            m_days += rule.день_смещения;
        }
        days += m_days;
    }
    days
}
