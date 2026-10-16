extern crate alloc;
use worldwiki_calendar_core::age::calculate_age;
use worldwiki_calendar_core::astronomy::{calculate_all_moon_phases, MoonConfig};
use worldwiki_calendar_core::audit::audit_calendar_culture;
use worldwiki_calendar_core::conversion::*;
use worldwiki_calendar_core::eras::*;
use worldwiki_calendar_core::leap::*;
use worldwiki_calendar_core::types::*;

#[test]
fn test_checklist_cross_calendar_different_day_start_offset() {
    let dial = DialHierarchy {
        units: alloc::vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
        ],
    };
    let months = [30; 12];
    let harmonics: [LeapHarmonic; 0] = [];
    let eras = alloc::vec![
        CoreEra {
            name: "Era".into(),
            start_year: 1,
            start_month: Some(1),
            start_day: Some(1),
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        },
    ];

    // Календарь A: смещение 0 (полночь)
    let config_a = CalendarCultureConfig {
        planet_id: "earth",
        ticks_per_day: 1440,
        day_start_offset: 0,
        base_year_days: 360,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &eras,
    };

    // Календарь B: смещение 360 (рассвет, +6 часов)
    let config_b = CalendarCultureConfig {
        planet_id: "earth",
        ticks_per_day: 1440,
        day_start_offset: 360,
        base_year_days: 360,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &eras,
    };

    let date_a = DateCoordinate {
        era_index: 0,
        year: 10,
        month: 5,
        day: 15,
        unit_values: alloc::vec![12, 0],
    };

    let date_b = convert_calendar_date(&date_a, &config_a, &config_b);
    let date_restored_a = convert_calendar_date(&date_b, &config_b, &config_a);

    assert_eq!(date_a.year, date_restored_a.year);
    assert_eq!(date_a.month, date_restored_a.month);
    assert_eq!(date_a.day, date_restored_a.day);
    assert_eq!(date_a.unit_values, date_restored_a.unit_values);
}

#[test]
fn test_checklist_linked_chain_resolution() {
    let resolved = resolve_sync_chain("calendar_3", |id| match id {
        "calendar_3" => Ok(Some("calendar_2")),
        "calendar_2" => Ok(Some("master")),
        "master" => Ok(None),
        _ => Err(ConversionError::MasterCalendarNotFound),
    });
    assert_eq!(resolved, Ok("master"));
}

#[test]
fn test_checklist_birth_april_31_clamped() {
    let rule = AgeRule::default();
    // Рождение 31 апреля (в апреле 30 дней)
    let birth = CalDate::new(2000, 4, 31);
    let curr = CalDate::new(2005, 4, 30);
    let age = calculate_age(birth, curr, &rule, 30);
    // 30 апреля уже считается днем рождения (так как 31 зажимается до 30)
    assert_eq!(age, 5);
}

#[test]
fn test_checklist_birth_first_month_zero_length() {
    let rule = AgeRule::default();
    // Рождение в первом месяце, у которого в текущем году 0 дней
    let birth = CalDate::new(2000, 1, 15);
    let curr = CalDate::new(2005, 2, 1);
    let age = calculate_age(birth, curr, &rule, 0);
    assert_eq!(age, 5);
}

#[test]
fn test_checklist_countdown_era_without_end_year_fails() {
    let bad_era = CoreEra {
        name: "Doomsday".into(),
        start_year: 100,
        start_month: None,
        start_day: None,
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: true,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };
    assert_eq!(validate_era(&bad_era, true), Err(EraValidationError::CountdownMissingEndYear));
}

#[test]
fn test_checklist_100_moons_batch_calculation() {
    let mut moons = alloc::vec::Vec::with_capacity(100);
    for i in 1..=100 {
        moons.push(MoonConfig {
            name: alloc::format!("Moon_{i}"),
            period_days_num: 20 + i,
            period_days_den: 1,
            initial_phase_bp: (i * 100) % 10_000,
        });
    }

    let phases = calculate_all_moon_phases(1_000_000, 86_400, &moons);
    assert_eq!(phases.len(), 100);
}

#[test]
fn test_checklist_1000_months_prefix_sums() {
    let months_count = 1000;
    let mut prefix_sums = alloc::vec::Vec::with_capacity(months_count + 1);
    prefix_sums.push(0i64);
    let mut acc = 0i64;
    for _ in 0..months_count {
        acc += 30;
        prefix_sums.push(acc);
    }

    let harmonics: [LeapHarmonic; 0] = [];
    let days_up_to_500 = days_up_to_month_with_prefix(
        2000,
        500,
        &prefix_sums,
        &LeapTarget::InExtraDays,
        0,
        &harmonics,
    );
    assert_eq!(days_up_to_500, 500 * 30);
}

#[test]
fn test_checklist_audit_calendar_one_click() {
    let dial = DialHierarchy {
        units: alloc::vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
            DialUnit { name: "Second".into(), subdivisions: 60 },
        ],
    };
    let months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let harmonics = [
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];
    let eras = [
        CoreEra {
            name: "CE".into(),
            start_year: 1,
            start_month: Some(1),
            start_day: Some(1),
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        },
    ];

    let config = CalendarCultureConfig {
        planet_id: "earth",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InMonth { target_month: 1 },
        leap_day_offset: 1,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &eras,
    };

    let report = audit_calendar_culture(&config, 3652422, 10000);
    assert!(report.is_valid, "Greorgian calendar config must be valid");
    assert!(report.errors.is_empty());
    assert_eq!(report.harmonics_cycle_years, 400);
}
