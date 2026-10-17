use worldwiki_calendar_core::*;
use crate::types::{MonthGridBundle, MonthGridDayInfo, MonthGridParams, MoonDayPhase};

pub fn build_month_grid_bundle(p: &MonthGridParams) -> MonthGridBundle {
    let core_cfg = p.config.as_core();
    let first_month = p.first_month_of_year.unwrap_or(0);
    let internal_m = holidays::to_internal_month(p.month, first_month, core_cfg.regular_months.len());

    let days_count = leap::days_in_month(
        p.year,
        internal_m,
        core_cfg.regular_months,
        &core_cfg.leap_target,
        core_cfg.leap_day_offset,
        core_cfg.harmonics,
    );

    let is_leap = leap::is_leap_year(p.year, core_cfg.harmonics) != 0;

    let days_before_year = leap::days_up_to_year(
        p.year,
        core_cfg.base_year_days,
        core_cfg.leap_day_offset,
        core_cfg.harmonics,
    );
    let days_before_month = leap::days_up_to_month(
        p.year,
        internal_m,
        core_cfg.regular_months,
        &core_cfg.leap_target,
        core_cfg.leap_day_offset,
        core_cfg.harmonics,
    );

    let weekdays_cnt = p.weekdays_count.unwrap_or(7);
    let start_wd = p.start_weekday.unwrap_or(0);

    let mut days = Vec::with_capacity(days_count as usize);

    for day_num in 1..=days_count {
        let day_in_year = days_before_month + (day_num - 1);
        let cal_day = days_before_year + day_in_year + core_cfg.calendar_origin_day;

        let weekday = if let Some(ref pause_p) = p.pause_config {
            let pause_cfg = weekdays::WeekdayPauseConfig {
                days_in_regular_months: pause_p.days_in_regular_months,
                extra_days_base: pause_p.extra_days_base,
                extra_days_leap: pause_p.extra_days_leap,
                harmonics: &pause_p.harmonics,
                origin_year: pause_p.origin_year,
                origin_day: pause_p.origin_day,
                start_weekday: pause_p.start_weekday,
                weekdays_count: pause_p.weekdays_count,
            };
            weekdays::calculate_weekday_with_pause(p.year, day_in_year, &pause_cfg)
        } else {
            Some(weekdays::calculate_weekday(cal_day, core_cfg.calendar_origin_day, start_wd, weekdays_cnt))
        };

        let mut active_holidays = Vec::new();
        if let Some(ref holidays_list) = p.holidays {
            for hol in holidays_list {
                if holidays::is_multi_year_holiday_active(p.year, p.month, day_num, hol) {
                    active_holidays.push(hol.name.clone());
                }
            }
        }

        let mut moon_phases = Vec::new();
        if let Some(ref moons_list) = p.moons {
            let noon_tick = core_cfg.ticks_per_day / 2;
            let moment = LocalMoment {
                planet_id: p.config.planet_id.clone(),
                world_day: cal_day,
                day_tick: noon_tick,
            };
            let day_t_abs = local_moment_to_t_abs(&moment, core_cfg.ticks_per_day, core_cfg.day_start_offset);

            for moon in moons_list {
                let (bp, phase_enum) = moons::moon_phase_rational(
                    day_t_abs,
                    core_cfg.ticks_per_day,
                    moon.period_days_num,
                    moon.period_days_den,
                    moon.initial_phase_bp,
                );
                let p_str = match phase_enum {
                    moons::MoonPhaseName::NewMoon => "new_moon",
                    moons::MoonPhaseName::WaxingCrescent => "waxing_crescent",
                    moons::MoonPhaseName::FirstQuarter => "first_quarter",
                    moons::MoonPhaseName::WaxingGibbous => "waxing_gibbous",
                    moons::MoonPhaseName::FullMoon => "full_moon",
                    moons::MoonPhaseName::WaningGibbous => "waning_gibbous",
                    moons::MoonPhaseName::LastQuarter => "last_quarter",
                    moons::MoonPhaseName::WaningCrescent => "waning_crescent",
                };
                moon_phases.push(MoonDayPhase {
                    moon_name: moon.name.clone(),
                    basis_points: bp,
                    phase_name: p_str.to_string(),
                });
            }
        }

        days.push(MonthGridDayInfo {
            day: day_num,
            cal_day,
            weekday,
            is_holiday: !active_holidays.is_empty(),
            holiday_names: active_holidays,
            moon_phases,
        });
    }

    MonthGridBundle {
        year: p.year,
        month: p.month,
        days_count,
        is_leap_year: is_leap,
        days,
    }
}

pub fn format_all_moon_phases(t_abs: i64, ticks_per_day: i64, moon_list: &[moons::MoonConfig]) -> Vec<MoonDayPhase> {
    let raw_phases = moons::calculate_all_moon_phases(t_abs, ticks_per_day, moon_list);
    raw_phases
        .into_iter()
        .zip(moon_list.iter())
        .map(|((bp, phase_enum), moon)| {
            let p_str = match phase_enum {
                moons::MoonPhaseName::NewMoon => "new_moon",
                moons::MoonPhaseName::WaxingCrescent => "waxing_crescent",
                moons::MoonPhaseName::FirstQuarter => "first_quarter",
                moons::MoonPhaseName::WaxingGibbous => "waxing_gibbous",
                moons::MoonPhaseName::FullMoon => "full_moon",
                moons::MoonPhaseName::WaningGibbous => "waning_gibbous",
                moons::MoonPhaseName::LastQuarter => "last_quarter",
                moons::MoonPhaseName::WaningCrescent => "waning_crescent",
            };
            MoonDayPhase {
                moon_name: moon.name.clone(),
                basis_points: bp,
                phase_name: p_str.to_string(),
            }
        })
        .collect()
}

