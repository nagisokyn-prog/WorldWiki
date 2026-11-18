use worldwiki_calendar_core::{DialHierarchy, DialUnit, LeapHarmonic, LeapTarget, holidays::CoreHoliday, moons::MoonConfig};
use worldwiki_calendar_wasm::grid::{build_month_grid_bundle, format_all_moon_phases};
use worldwiki_calendar_wasm::types::{MonthGridParams, WasmCultureConfig, WasmWeekdayPauseParams};
use worldwiki_calendar_wasm::WasmCalendarEngine;

fn sample_config() -> WasmCultureConfig {
    WasmCultureConfig {
        planet_id: "earth".into(),
        ticks_per_day: 86_400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: vec![31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        harmonics: vec![LeapHarmonic {
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 4,
            weight: 1,
        }],
        leap_target: LeapTarget::InMonth { target_month: 1 },
        leap_day_offset: 1,
        calendar_origin_day: 0,
        dial: DialHierarchy {
            units: vec![
                DialUnit {
                    name: "hour".into(),
                    subdivisions: 24,
                },
                DialUnit {
                    name: "minute".into(),
                    subdivisions: 60,
                },
            ],
        },
        eras: vec![],
    }
}

#[test]
fn test_wasm_culture_config_as_core_and_grid_bundle() {
    let cfg = sample_config();
    let core = cfg.as_core();
    assert_eq!(core.planet_id, "earth");
    assert_eq!(core.base_year_days, 365);

    let params = MonthGridParams {
        year: 4,
        month: 1,
        config: cfg,
        first_month_of_year: Some(0),
        pause_config: None,
        start_weekday: Some(0),
        weekdays_count: Some(7),
        holidays: Some(vec![CoreHoliday {
            name: "Midwinter".into(),
            start_month: 1,
            start_day: 15,
            end_month: 1,
            end_day: 15,
            duration_years: 1,
            start_year: None,
        }]),
        moons: Some(vec![MoonConfig {
            name: "Luna".into(),
            period_days_num: 28,
            period_days_den: 1,
            initial_phase_bp: 0,
        }]),
    };

    let bundle = build_month_grid_bundle(&params);
    assert!(bundle.is_leap_year);
    assert_eq!(bundle.days_count, 29);
    assert_eq!(bundle.days.len(), 29);
    assert!(bundle.days[14].is_holiday);
    assert_eq!(bundle.days[14].holiday_names, vec!["Midwinter"]);
    assert!(!bundle.days[0].is_holiday);
    assert_eq!(bundle.days[0].moon_phases.len(), 1);
    assert_eq!(bundle.days[0].moon_phases[0].moon_name, "Luna");
}

#[test]
fn test_grid_bundle_with_pause_config_and_format_all_moon_phases() {
    let mut cfg = sample_config();
    cfg.regular_months = vec![30; 12];
    cfg.leap_target = LeapTarget::InExtraDays;

    let params = MonthGridParams {
        year: 1,
        month: 0,
        config: cfg,
        first_month_of_year: None,
        pause_config: Some(WasmWeekdayPauseParams {
            days_in_regular_months: 360,
            extra_days_base: 5,
            extra_days_leap: 6,
            harmonics: vec![],
            origin_year: 0,
            origin_day: 0,
            start_weekday: 0,
            weekdays_count: 7,
        }),
        start_weekday: None,
        weekdays_count: None,
        holidays: None,
        moons: None,
    };

    let bundle = build_month_grid_bundle(&params);
    assert_eq!(bundle.days_count, 30);
    assert!(bundle.days[0].weekday.is_some());

    let moons = vec![
        MoonConfig {
            name: "Luna".into(),
            period_days_num: 28,
            period_days_den: 1,
            initial_phase_bp: 0,
        },
        MoonConfig {
            name: "Selene".into(),
            period_days_num: 28,
            period_days_den: 1,
            initial_phase_bp: 5_000,
        },
    ];
    let formatted = format_all_moon_phases(0, 86_400, &moons);
    assert_eq!(formatted.len(), 2);
    assert_eq!(formatted[0].phase_name, "new_moon");
    assert_eq!(formatted[1].phase_name, "full_moon");
}

#[test]
fn test_wasm_calendar_engine_primitive_methods() {
    let engine = WasmCalendarEngine;

    // Astronomy
    let noon = engine.solar_noon_tick(86_400, 0, false);
    assert_eq!(noon, 43_200);
    let zenith = engine.solar_zenith_distance_mdeg(43_200, 86_400, 0, false);
    assert_eq!(zenith, 0);
    let sun = engine.sunlight_basis_points(43_200, 86_400, 0, false);
    assert_eq!(sun, 10_000);

    // Conversions
    assert_eq!(engine.local_moment_to_t_abs("earth", 1, 100, 86_400, 0), 86_500);
    let tick = engine.units_to_day_tick(vec![12, 0], vec![24, 60], 86_400);
    assert_eq!(tick, 43_200);
    let units = engine.day_tick_to_units(43_200, vec![24, 60], 86_400);
    assert_eq!(units, vec![12, 0]);
    assert_eq!(engine.calculate_weekday(7, 0, 0, 7), 0);

    // Intervals
    assert!(engine.intervals_overlap(0, 10, 5, 15));
    assert!(!engine.intervals_overlap(0, 10, 10, 20));
    assert!(engine.check_bilocation(0, 10, "loc_a", 5, 15, "loc_b"));
    assert!(!engine.check_bilocation(0, 10, "loc_a", 5, 15, "loc_a"));
    assert!(engine.check_death_violation(50, 100, 80));
    assert!(!engine.check_death_violation(10, 50, 80));

    // Seasons & holidays
    assert!(engine.is_holiday_active(11, 31, 11, 25, 0, 6));
    assert!(!engine.is_holiday_active(5, 1, 11, 25, 0, 6));
    assert!(engine.is_season_conflicting_with_solstice(vec![11, 0], true, 11, 12));
    assert!(!engine.is_season_conflicting_with_solstice_hemisphere(
        vec![11, 0],
        true,
        11,
        12,
        "southern"
    ));
}
