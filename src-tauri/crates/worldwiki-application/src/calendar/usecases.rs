use serde_json::Value;
use worldwiki_domain::calendar::core::astronomy::{calculate_daylight_and_sun_events, moon_phase_rational, PlanetSunContext};
use worldwiki_domain::calendar::core::convergents::calculate_leap_convergents;
use worldwiki_domain::calendar::core::holidays::is_holiday_active;
use worldwiki_domain::calendar::core::leap::drift_per_century;
use worldwiki_domain::calendar::{CalendarData, CalendarMath};
use crate::errors::ApplicationError;
use super::dtos::*;

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

    /// Карточка 4.1 / UX инвариант: Валидация каскадного сдвига при изменении мастер-календаря
    pub fn validate_master_calendar_mutation(
        &self,
        params: &ValidateMasterCalendarMutationParams,
    ) -> Result<Value, ApplicationError> {
        let mut affected = Vec::new();

        for linked in &params.linked_calendars {
            let Some(anchor) = &linked.sync_anchor else { continue };
            if !anchor.linked_to_master { continue };
            let Some(master_date) = &anchor.master_anchor_date else { continue };

            let old_abs = CalendarMath::get_absolute_minute(
                &params.old_master_calendar,
                master_date.era_index,
                master_date.year,
                master_date.month,
                master_date.day,
                master_date.hour,
                master_date.minute,
            );
            let new_abs = CalendarMath::get_absolute_minute(
                &params.new_master_calendar,
                master_date.era_index,
                master_date.year,
                master_date.month,
                master_date.day,
                master_date.hour,
                master_date.minute,
            );
            let drift_minutes = new_abs - old_abs;

            if drift_minutes != 0 {
                affected.push(serde_json::json!({
                    "calendarName": linked.название,
                    "oldMasterMinute": old_abs,
                    "newMasterMinute": new_abs,
                    "driftMinutes": drift_minutes,
                    "localAnchorDate": anchor.local_anchor_date,
                    "masterAnchorDate": master_date,
                }));
            }
        }

        let has_drift = !affected.is_empty();
        Ok(serde_json::json!({
            "hasDrift": has_drift,
            "affectedCalendarsCount": affected.len(),
            "affectedCalendars": affected
        }))
    }

    /// Пакетный пересчет опорных якорей для связных календарей
    pub fn recalculate_linked_anchors(
        &self,
        params: &RecalculateLinkedAnchorsParams,
    ) -> Result<Value, ApplicationError> {
        let mut updated_calendars = Vec::new();

        for mut linked in params.linked_calendars.clone() {
            let Some(anchor) = linked.sync_anchor.clone() else { continue };
            if !anchor.linked_to_master { continue };
            let (Some(master_date), Some(local_date)) =
                (&anchor.master_anchor_date, &anchor.local_anchor_date) else { continue };

            let master_t_abs = CalendarMath::get_absolute_minute(
                &params.master_calendar,
                master_date.era_index,
                master_date.year,
                master_date.month,
                master_date.day,
                master_date.hour,
                master_date.minute,
            );
            let local_t_day = CalendarMath::get_absolute_minute(
                &linked,
                local_date.era_index,
                local_date.year,
                local_date.month,
                local_date.day,
                local_date.hour,
                local_date.minute,
            );

            if let Some(ref mut a) = linked.sync_anchor {
                a.master_absolute_minute = master_t_abs;
                a.local_absolute_minute = local_t_day;
            }
            updated_calendars.push(linked);
        }

        Ok(serde_json::json!({
            "updatedCount": updated_calendars.len(),
            "updatedCalendars": updated_calendars
        }))
    }

    /// Детектор сдвига точки отсчета календаря (origin_day/start_weekday).
    pub fn detect_origin_weekday_shift(
        &self,
        old_origin_day: i64,
        old_start_weekday: usize,
        new_origin_day: i64,
        new_start_weekday: usize,
        weekdays_count: usize,
    ) -> Value {
        if weekdays_count == 0 {
            return serde_json::json!({ "shifted": false, "shiftDays": 0 });
        }
        let old_offset = (-old_origin_day + old_start_weekday as i64).rem_euclid(weekdays_count as i64);
        let new_offset = (-new_origin_day + new_start_weekday as i64).rem_euclid(weekdays_count as i64);
        let shift = (new_offset - old_offset).rem_euclid(weekdays_count as i64);
        serde_json::json!({
            "shifted": shift != 0,
            "shiftDays": shift,
            "requiresAuthorDecision": shift != 0,
            "options": ["lens", "fix"]
        })
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
    use worldwiki_domain::calendar::DateCoordinate;

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

    #[test]
    fn test_validate_and_recalculate_master_calendar_drift() {
        let services = CalendarServices::new();

        let old_master = CalendarData {
            название: "Empire Master".into(),
            calendar_type: Some("solar".into()),
            is_master: Some(true),
            months: vec![],
            eras: vec![],
            leap_year_rule: "gregorian".into(),
            custom_leap_rule: None,
            time_settings: None,
            moons: None,
            sync_anchor: None,
            planet_id: None,
            ticks_per_day: Some(86400),
            day_start_offset: None,
            retrograde: None,
            dial_hierarchy: None,
        };

        let mut new_master = old_master.clone();
        new_master.leap_year_rule = "none".into();

        let linked_cal = CalendarData {
            название: "Mars Colony".into(),
            calendar_type: Some("solar".into()),
            is_master: Some(false),
            months: vec![],
            eras: vec![],
            leap_year_rule: "none".into(),
            custom_leap_rule: None,
            time_settings: None,
            moons: None,
            sync_anchor: Some(worldwiki_domain::calendar::models::SyncAnchor {
                master_calendar_id: Some("master_1".into()),
                local_absolute_minute: 0,
                master_absolute_minute: 0,
                linked_to_master: true,
                local_anchor_date: Some(DateCoordinate {
                    era_index: 0,
                    year: 1,
                    month: 1,
                    day: 1,
                    hour: 0,
                    minute: 0,
                }),
                master_anchor_date: Some(DateCoordinate {
                    era_index: 0,
                    year: 100,
                    month: 1,
                    day: 1,
                    hour: 0,
                    minute: 0,
                }),
            }),
            planet_id: None,
            ticks_per_day: Some(86400),
            day_start_offset: None,
            retrograde: None,
            dial_hierarchy: None,
        };

        let val_params = ValidateMasterCalendarMutationParams {
            old_master_calendar: old_master,
            new_master_calendar: new_master.clone(),
            linked_calendars: vec![linked_cal.clone()],
        };

        let val_res = services.validate_master_calendar_mutation(&val_params).expect("Failed validation");
        assert_eq!(val_res["hasDrift"], true);
        assert_eq!(val_res["affectedCalendarsCount"], 1);

        let recalc_params = RecalculateLinkedAnchorsParams {
            master_calendar: new_master,
            linked_calendars: vec![linked_cal],
        };
        let recalc_res = services.recalculate_linked_anchors(&recalc_params).expect("Failed recalculation");
        assert_eq!(recalc_res["updatedCount"], 1);
    }
}
