use serde::{Deserialize, Serialize};
use worldwiki_domain::calendar::{CalendarData, DateCoordinate};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConvertCalendarDateParams {
    pub from_calendar: CalendarData,
    pub to_calendar: CalendarData,
    pub master_calendar: Option<CalendarData>,
    pub date: DateCoordinate,
    pub target_era_index: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PairLinkedCalendarParams {
    pub master_date: DateCoordinate,
    pub local_date: DateCoordinate,
    pub master_calendar: CalendarData,
    pub local_calendar: CalendarData,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LeapApproximationsParams {
    pub tropical_year_num: i64,
    pub tropical_year_den: i64,
    pub max_convergents: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CheckHolidayActiveParams {
    pub current_month: usize,
    pub current_day: i64,
    pub start_month: usize,
    pub start_day: i64,
    pub end_month: Option<usize>,
    pub end_day: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalculateSunEventsParams {
    pub world_day: i64,
    pub latitude: f64,
    pub longitude: f64,
    pub summer_day_fraction: Option<f64>,
    pub winter_day_fraction: Option<f64>,
    pub ticks_per_day: i64,
    pub is_retrograde_rotation: bool,
    pub tropical_year_num: i64,
    pub tropical_year_den: i64,
    pub solstice_world_day: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MoonQueryItem {
    pub id: String,
    pub period_days_num: i64,
    pub period_days_den: i64,
    pub initial_phase: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalculateMoonPhasesParams {
    pub t_abs: i64,
    pub ticks_per_day: i64,
    pub moons: Vec<MoonQueryItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalculateCharacterAgeParams {
    pub birth_year: i64,
    pub birth_month: usize,
    pub birth_day: i64,
    pub current_year: i64,
    pub current_month: usize,
    pub current_day: i64,
    pub age_at_birth: i32,
    pub step_on_new_year: bool,
    pub year_only: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ValidateMasterCalendarMutationParams {
    pub old_master_calendar: CalendarData,
    pub new_master_calendar: CalendarData,
    pub linked_calendars: Vec<CalendarData>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecalculateLinkedAnchorsParams {
    pub master_calendar: CalendarData,
    pub linked_calendars: Vec<CalendarData>,
}
