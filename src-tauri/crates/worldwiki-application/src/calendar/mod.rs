use serde::{Deserialize, Serialize};
use serde_json::Value;
use worldwiki_domain::calendar::{CalendarData, CalendarMath, DateCoordinate};
use crate::errors::ApplicationError;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConvertCalendarDateParams {
    pub from_calendar: CalendarData,
    pub to_calendar: CalendarData,
    pub master_calendar: Option<CalendarData>,
    pub date: DateCoordinate,
    pub target_era_index: Option<usize>,
}

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

    pub fn convert_calendar_date(
        &self,
        params: &ConvertCalendarDateParams,
    ) -> Result<Value, ApplicationError> {
        let (res_year, res_month, res_day, res_hour, res_minute) =
            CalendarMath::convert_between_calendars(
                &params.from_calendar,
                &params.to_calendar,
                params.master_calendar.as_ref(),
                &params.date,
                params.target_era_index.unwrap_or(0),
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
