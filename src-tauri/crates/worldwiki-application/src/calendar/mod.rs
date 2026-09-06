use worldwiki_domain::calendar::{CalendarData, CalendarMath};
use crate::errors::ApplicationError;
use serde_json::Value;

pub struct CalendarServices;

impl CalendarServices {
    pub fn new() -> Self {
        Self
    }

    pub fn convert_absolute_to_local(
        &self,
        absolute_minute: i64,
        calendar: &CalendarData,
        era_index: usize,
    ) -> Result<Value, ApplicationError> {
        let (year, month, day, hour, minute) =
            CalendarMath::get_date_from_absolute(absolute_minute, calendar, era_index);

        let month_name = calendar.months.get((month - 1).max(0) as usize).map(|m| m.название.as_str()).unwrap_or("");
        let era_name = calendar.eras.get(era_index).map(|e| e.название.as_str()).unwrap_or("");
        let formatted = format!("{day} {month_name} {year} г., {hour:02}:{minute:02} ({era_name})");

        Ok(serde_json::json!({
            "year": year,
            "month": month,
            "day": day,
            "hour": hour,
            "minute": minute,
            "formatted": formatted.trim()
        }))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn convert_calendar_date(
        &self,
        from_calendar: &CalendarData,
        to_calendar: &CalendarData,
        master_calendar: Option<&CalendarData>,
        era_index: usize,
        year: i32,
        month: i32,
        day: i32,
        hour: i32,
        minute: i32,
        target_era_index: Option<usize>,
    ) -> Result<Value, ApplicationError> {
        let (res_year, res_month, res_day, res_hour, res_minute) =
            CalendarMath::convert_between_calendars(
                from_calendar,
                to_calendar,
                master_calendar,
                era_index,
                year,
                month,
                day,
                hour,
                minute,
                target_era_index.unwrap_or(0),
            );

        Ok(serde_json::json!({
            "year": res_year,
            "month": res_month,
            "day": res_day,
            "hour": res_hour,
            "minute": res_minute
        }))
    }
}

impl Default for CalendarServices {
    fn default() -> Self {
        Self::new()
    }
}
