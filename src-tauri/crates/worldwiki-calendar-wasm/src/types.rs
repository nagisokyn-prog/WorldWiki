pub use worldwiki_calendar_core::*;

#[derive(serde::Deserialize)]
pub struct WasmCultureConfig {
    pub planet_id: String,
    pub ticks_per_day: i64,
    pub day_start_offset: i64,
    pub base_year_days: i64,
    pub regular_months: Vec<i32>,
    pub harmonics: Vec<LeapHarmonic>,
    pub leap_target: LeapTarget,
    pub leap_day_offset: i64,
    pub calendar_origin_day: i64,
    pub dial: DialHierarchy,
    pub eras: Vec<CoreEra>,
}

impl WasmCultureConfig {
    pub fn as_core(&self) -> CalendarCultureConfig<'_> {
        CalendarCultureConfig {
            planet_id: &self.planet_id,
            ticks_per_day: self.ticks_per_day,
            day_start_offset: self.day_start_offset,
            base_year_days: self.base_year_days,
            regular_months: &self.regular_months,
            harmonics: &self.harmonics,
            leap_target: self.leap_target,
            leap_day_offset: self.leap_day_offset,
            calendar_origin_day: self.calendar_origin_day,
            dial: &self.dial,
            eras: &self.eras,
        }
    }
}

#[derive(serde::Deserialize)]
pub struct WasmWeekdayPauseParams {
    pub days_in_regular_months: i64,
    pub extra_days_base: i64,
    pub extra_days_leap: i64,
    pub harmonics: Vec<LeapHarmonic>,
    pub origin_year: i64,
    pub origin_day: i64,
    pub start_weekday: usize,
    pub weekdays_count: usize,
}

#[derive(serde::Deserialize)]
pub struct MonthGridParams {
    pub year: i64,
    pub month: usize,
    pub config: WasmCultureConfig,
    pub first_month_of_year: Option<usize>,
    pub pause_config: Option<WasmWeekdayPauseParams>,
    pub start_weekday: Option<usize>,
    pub weekdays_count: Option<usize>,
    pub holidays: Option<Vec<holidays::CoreHoliday>>,
    pub moons: Option<Vec<moons::MoonConfig>>,
}

#[derive(serde::Serialize)]
pub struct MoonDayPhase {
    pub moon_name: String,
    pub basis_points: i64,
    pub phase_name: String,
}

#[derive(serde::Serialize)]
pub struct MonthGridDayInfo {
    pub day: i64,
    pub cal_day: i64,
    pub weekday: Option<usize>,
    pub is_holiday: bool,
    pub holiday_names: Vec<String>,
    pub moon_phases: Vec<MoonDayPhase>,
}

#[derive(serde::Serialize)]
pub struct MonthGridBundle {
    pub year: i64,
    pub month: usize,
    pub days_count: i64,
    pub is_leap_year: bool,
    pub days: Vec<MonthGridDayInfo>,
}
