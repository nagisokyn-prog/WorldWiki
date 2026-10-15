use serde::{Deserialize, Serialize};
use serde_json::Value;
use worldwiki_domain::calendar::core::astronomy::{calculate_daylight_and_sun_events, moon_phase_rational, PlanetSunContext};
use worldwiki_domain::calendar::core::convergents::calculate_leap_convergents;
use worldwiki_domain::calendar::core::holidays::is_holiday_active;
use worldwiki_domain::calendar::core::leap::drift_per_century;
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

    /// Карточка 4.1: Сопряжение связного календаря культуры с мастер-календарем
    pub fn pair_linked_calendar(
        &self,
        params: &PairLinkedCalendarParams,
    ) -> Result<Value, ApplicationError> {
        let master_abs_minute = CalendarMath::get_absolute_minute(
            &params.master_calendar,
            params.master_date.era_index,
            params.master_date.year,
            params.master_date.month,
            params.master_date.day,
            params.master_date.hour,
            params.master_date.minute,
        );

        let local_abs_minute = CalendarMath::get_absolute_minute(
            &params.local_calendar,
            params.local_date.era_index,
            params.local_date.year,
            params.local_date.month,
            params.local_date.day,
            params.local_date.hour,
            params.local_date.minute,
        );

        let anchor_world_day = (master_abs_minute - local_abs_minute).div_euclid(24 * 60);

        Ok(serde_json::json!({
            "anchorWorldDay": anchor_world_day
        }))
    }

    /// Карточка 4.9: Помощник цепных дробей для високосных циклов
    pub fn calculate_leap_approximations(
        &self,
        params: &LeapApproximationsParams,
    ) -> Result<Value, ApplicationError> {
        let max_conv = params.max_convergents.unwrap_or(5);
        let convergents = calculate_leap_convergents(params.tropical_year_num, params.tropical_year_den, max_conv);
        let mut items = Vec::new();

        for c in &convergents {
            let harmonics = [worldwiki_domain::calendar::core::types::LeapHarmonic {
                multiplier_a: c.leap_years,
                shift_b: 0,
                divisor_c: c.cycle_years,
                weight: 1,
            }];
            let drift = drift_per_century(365, &harmonics, params.tropical_year_num, params.tropical_year_den);
            items.push(serde_json::json!({
                "leapYears": c.leap_years,
                "cycleYears": c.cycle_years,
                "driftPerCentury": drift,
                "label": format!("{}/{}", c.leap_years, c.cycle_years)
            }));
        }

        Ok(serde_json::json!({ "approximations": items }))
    }

    /// Карточка 4.8: Проверка активности праздников
    pub fn check_holiday_active(
        &self,
        params: &CheckHolidayActiveParams,
    ) -> Result<Value, ApplicationError> {
        let em = params.end_month.unwrap_or(params.start_month);
        let ed = params.end_day.unwrap_or(params.start_day);

        let active = is_holiday_active(
            params.current_month,
            params.current_day,
            params.start_month,
            params.start_day,
            em,
            ed,
        );

        Ok(serde_json::json!({ "isActive": active }))
    }


    /// Карточка 4.11 / 4.0: Астрономия Солнца и длины дня
    pub fn calculate_sun_events(
        &self,
        params: &CalculateSunEventsParams,
    ) -> Result<Value, ApplicationError> {
        let summer_bp = (params.summer_day_fraction.unwrap_or(0.5) * 10_000.0) as i64;
        let winter_bp = (params.winter_day_fraction.unwrap_or(0.5) * 10_000.0) as i64;
        let lon_mdeg = (params.longitude * 1_000.0) as i64;

        let ctx = PlanetSunContext {
            solstice_world_day: params.solstice_world_day,
            ticks_per_day: params.ticks_per_day,
            tropical_year_num: params.tropical_year_num,
            tropical_year_den: params.tropical_year_den,
            summer_day_fraction_bp: summer_bp,
            winter_day_fraction_bp: winter_bp,
            is_north_hemisphere: params.latitude >= 0.0,
            longitude_mdeg: lon_mdeg,
            retrograde: params.is_retrograde_rotation,
        };

        let events = calculate_daylight_and_sun_events(params.world_day, &ctx);

        Ok(serde_json::json!({
            "solarNoonTick": events.noon_tick,
            "daylightTicks": events.daylight_ticks,
            "sunriseTick": events.sunrise_tick,
            "sunsetTick": events.sunset_tick
        }))
    }

    /// Карточка 4.12: Фазы спутников и лун
    pub fn calculate_moon_phases(
        &self,
        params: &CalculateMoonPhasesParams,
    ) -> Result<Value, ApplicationError> {
        let mut results = Vec::new();
        for m in &params.moons {
            let initial_bp = (m.initial_phase * 10_000.0) as i64;
            let (phase_bp, phase_enum) = moon_phase_rational(
                params.t_abs,
                params.ticks_per_day,
                m.period_days_num,
                m.period_days_den,
                initial_bp,
            );


            let phase_name = match phase_enum {
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::NewMoon => "new",
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::WaxingCrescent |
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::FirstQuarter |
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::WaxingGibbous => "waxing",
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::FullMoon => "full",
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::WaningGibbous |
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::LastQuarter |
                worldwiki_domain::calendar::core::astronomy::MoonPhaseName::WaningCrescent => "waning",
            };

            results.push(serde_json::json!({
                "id": m.id,
                "phaseBp": phase_bp,
                "phaseCategory": phase_name
            }));
        }

        Ok(serde_json::json!({ "moons": results }))
    }

    /// Карточка 4.13: Расчет возраста персонажа
    pub fn calculate_character_age(
        &self,
        params: &CalculateCharacterAgeParams,
    ) -> Result<Value, ApplicationError> {
        let rule = worldwiki_domain::calendar::core::types::AgeRule {
            age_at_birth: params.age_at_birth,
            step_on_new_year: params.step_on_new_year,
            year_only: params.year_only,
        };

        let birth = worldwiki_domain::calendar::core::types::CalDate::new(
            params.birth_year,
            params.birth_month,
            params.birth_day,
        );
        let current = worldwiki_domain::calendar::core::types::CalDate::new(
            params.current_year,
            params.current_month,
            params.current_day,
        );

        let max_days = if params.birth_month == 1
            && (params.current_year % 4 != 0
                || (params.current_year % 100 == 0 && params.current_year % 400 != 0))
        {
            28
        } else {
            31
        };

        let age = worldwiki_domain::calendar::core::age::calculate_age(
            birth,
            current,
            &rule,
            max_days,
        );

        Ok(serde_json::json!({ "age": age }))
    }

}

impl Default for CalendarServices {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_leap_approximations_usecase() {
        let services = CalendarServices::new();
        let params = LeapApproximationsParams {
            tropical_year_num: 3652422,
            tropical_year_den: 10000,
            max_convergents: Some(5),
        };
        let res = services.calculate_leap_approximations(&params).expect("Failed approximations");
        let list = res.get("approximations").and_then(|v| v.as_array()).expect("List not found");
        assert!(!list.is_empty());
        assert_eq!(list[0]["label"], "1/4");
    }

    #[test]
    fn test_check_holiday_active_usecase() {
        let services = CalendarServices::new();
        // Йоль через Новый Год
        let params = CheckHolidayActiveParams {
            current_month: 11,
            current_day: 31,
            start_month: 11,
            start_day: 25,
            end_month: Some(0),
            end_day: Some(6),
        };
        let res = services.check_holiday_active(&params).expect("Failed check holiday");
        assert_eq!(res["isActive"], true);
    }

    #[test]
    fn test_calculate_sun_events_usecase() {
        let services = CalendarServices::new();
        let params = CalculateSunEventsParams {
            world_day: 355,
            latitude: 55.0,
            longitude: 0.0,
            summer_day_fraction: Some(0.70),
            winter_day_fraction: Some(0.30),
            ticks_per_day: 86400,
            is_retrograde_rotation: false,
            tropical_year_num: 365,
            tropical_year_den: 1,
            solstice_world_day: 355,
        };
        let res = services.calculate_sun_events(&params).expect("Failed sun events");
        assert!(res["solarNoonTick"].as_i64().is_some());
        assert!(res["daylightTicks"].as_i64().is_some());
        assert!(res["sunriseTick"].as_i64().is_some());
        assert!(res["sunsetTick"].as_i64().is_some());
    }

    #[test]
    fn test_calculate_moon_phases_usecase() {
        let services = CalendarServices::new();
        let params = CalculateMoonPhasesParams {
            t_abs: 0,
            ticks_per_day: 86400,
            moons: vec![MoonQueryItem {
                id: "luna".into(),
                period_days_num: 28,
                period_days_den: 1,
                initial_phase: 0.0,
            }],
        };
        let res = services.calculate_moon_phases(&params).expect("Failed moon phases");
        let moons = res["moons"].as_array().expect("moons list");
        assert_eq!(moons.len(), 1);
        assert_eq!(moons[0]["phaseCategory"], "new");
    }

    #[test]
    fn test_calculate_character_age_usecase() {
        let services = CalendarServices::new();
        let params = CalculateCharacterAgeParams {
            birth_year: 2000,
            birth_month: 5,
            birth_day: 10,
            current_year: 2026,
            current_month: 5,
            current_day: 15,
            age_at_birth: 0,
            step_on_new_year: false,
            year_only: false,
        };
        let res = services.calculate_character_age(&params).expect("Failed age");
        assert_eq!(res["age"], 26);
    }
}


