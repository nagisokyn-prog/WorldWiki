use crate::eras::{
    era_contains_date, era_year_number, find_active_era, validate_era, EraValidationError,
};
use crate::types::{CoreEra, EraCountingMode};
use alloc::string::String;

#[kani::proof]
fn proof_open_era_unbounded() {
    let year: i64 = kani::any();
    kani::assume(year >= 2000 && year <= 2100);

    let era = CoreEra {
        name: String::new(),
        start_year: 2000,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };

    assert!(era_contains_date(&era, year, 6, 15));
}

#[kani::proof]
fn proof_coronation_day_clamped() {
    let day_in_month: i64 = kani::any();
    kani::assume(day_in_month >= 25 && day_in_month <= 31);
    let max_days: i64 = kani::any();
    kani::assume(max_days >= 28 && max_days <= 30);

    let era = CoreEra {
        name: String::new(),
        start_year: 2000,
        start_month: Some(4),
        start_day: Some(31), // 31 апреля (не существует в 30-дневном месяце)
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByAnniversary,
        priority: 0,
    };

    let yr = era_year_number(&era, 2001, 4, day_in_month, max_days);
    if day_in_month >= max_days {
        assert_eq!(yr, 2);
    } else {
        assert_eq!(yr, 1);
    }
}

#[kani::proof]
fn proof_era_validation_countdown() {
    let era_invalid = CoreEra {
        name: String::new(),
        start_year: 1000,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: true,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };

    assert_eq!(
        validate_era(&era_invalid, true),
        Err(EraValidationError::CountdownMissingEndYear)
    );
}

#[kani::proof]
fn proof_era_year_zero_boundary() {
    let era_zero = CoreEra {
        name: String::new(),
        start_year: 0,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };

    assert_eq!(era_year_number(&era_zero, 0, 1, 1, 30), 1);

    let era_neg = CoreEra {
        name: String::new(),
        start_year: -500,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };

    assert_eq!(era_year_number(&era_neg, -500, 1, 1, 30), 1);
    assert_eq!(era_year_number(&era_neg, -499, 1, 1, 30), 2);
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_era_priority_tie_breaking() {
    let eras = [
        CoreEra {
            name: String::new(),
            start_year: 100,
            start_month: Some(1),
            start_day: Some(1),
            end_year: Some(200),
            end_month: Some(12),
            end_day: Some(31),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 5,
        },
        CoreEra {
            name: String::new(),
            start_year: 100,
            start_month: Some(1),
            start_day: Some(1),
            end_year: Some(200),
            end_month: Some(12),
            end_day: Some(31),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 10,
        },
    ];

    let Some(winner) = find_active_era(&eras, 150, 5, 10) else {
        return;
    };
    assert_eq!(winner.priority, 10);
}

#[kani::proof]
fn proof_era_countdown_has_end() {
    let has_end: bool = kani::any();
    let is_countdown: bool = kani::any();

    let era = CoreEra {
        name: String::new(),
        start_year: 1000,
        start_month: Some(1),
        start_day: Some(1),
        end_year: if has_end { Some(1500) } else { None },
        end_month: Some(12),
        end_day: Some(31),
        is_count_down: is_countdown,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };

    let res = validate_era(&era, true);
    if is_countdown && !has_end {
        assert_eq!(res, Err(EraValidationError::CountdownMissingEndYear));
    }
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_era_no_overlap() {
    let eras = [
        CoreEra {
            name: String::new(),
            start_year: 100,
            start_month: Some(1),
            start_day: Some(1),
            end_year: Some(199),
            end_month: Some(12),
            end_day: Some(31),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        },
        CoreEra {
            name: String::new(),
            start_year: 200,
            start_month: Some(1),
            start_day: Some(1),
            end_year: Some(299),
            end_month: Some(12),
            end_day: Some(31),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        },
    ];

    let Some(found) = find_active_era(&eras, 150, 1, 1) else {
        return;
    };
    assert_eq!(found.start_year, 100);

    let gap = find_active_era(&eras, 350, 1, 1);
    assert!(gap.is_none());
}

