use worldwiki_calendar_core::conversion::*;
use worldwiki_calendar_core::types::*;

fn create_standard_earth_config<'a>(
    dial: &'a DialHierarchy,
    harmonics: &'a [LeapHarmonic],
    months: &'a [i32],
    eras: &'a [CoreEra],
) -> CalendarCultureConfig<'a> {
    CalendarCultureConfig {
        planet_id: "earth",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: months,
        harmonics,
        leap_target: LeapTarget::InMonth { target_month: 1 }, // Февраль
        leap_day_offset: 1,
        calendar_origin_day: 0,
        dial,
        eras,
    }
}

#[test]
fn test_conversion_reversibility() {
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
            DialUnit { name: "Second".into(), subdivisions: 60 },
        ],
    };
    let harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];
    let months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let eras = vec![
        CoreEra {
            name: "AD".into(),
            start_year: 1,
            start_month: Some(1),
            start_day: Some(1),
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
    ];

    let config = create_standard_earth_config(&dial, &harmonics, &months, &eras);

    let test_dates = [
        DateCoordinate { era_index: 0, year: 2000, month: 1, day: 1, unit_values: vec![0, 0, 0] },
        DateCoordinate { era_index: 0, year: 2000, month: 2, day: 29, unit_values: vec![12, 30, 45] },
        DateCoordinate { era_index: 0, year: 2024, month: 7, day: 15, unit_values: vec![23, 59, 59] },
        DateCoordinate { era_index: 0, year: 1, month: 1, day: 1, unit_values: vec![0, 0, 0] },
    ];

    for orig_date in test_dates {
        let t_abs = date_to_t_abs(&orig_date, &config);
        let restored = t_abs_to_date(t_abs, &config);

        assert_eq!(restored.year, orig_date.year, "Year mismatch");
        assert_eq!(restored.month, orig_date.month, "Month mismatch");
        assert_eq!(restored.day, orig_date.day, "Day mismatch");
        assert_eq!(restored.unit_values, orig_date.unit_values, "Time mismatch");
    }
}
