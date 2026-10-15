use crate::eras::{era_contains_date, era_year_number, find_active_era};
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
    };

    assert!(era_contains_date(&era, year, 6, 15));
}

#[kani::proof]
fn proof_coronation_leap_day_clamped() {
    let era = CoreEra {
        name: String::new(),
        start_year: 2000,
        start_month: Some(2),
        start_day: Some(29), // Високосный день коронации
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByAnniversary,
    };

    let year = 2001; // Невисокосный год, в феврале 28 дней
    let era_yr_before = era_year_number(&era, year, 2, 27, 28);
    let era_yr_on = era_year_number(&era, year, 2, 28, 28);
    let era_yr_after = era_year_number(&era, year, 3, 1, 31);

    assert_eq!(era_yr_before, 1);
    assert_eq!(era_yr_on, 2);
    assert_eq!(era_yr_after, 2);
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_binary_search_finds_era() {
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
        },
        CoreEra {
            name: String::new(),
            start_year: 200,
            start_month: Some(1),
            start_day: Some(1),
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
    ];

    let found_first = find_active_era(&eras, 150, 5, 10);
    assert!(found_first.is_some());
    assert_eq!(found_first.unwrap().start_year, 100);

    let found_second = find_active_era(&eras, 250, 5, 10);
    assert!(found_second.is_some());
    assert_eq!(found_second.unwrap().start_year, 200);

    let found_before = find_active_era(&eras, 50, 5, 10);
    assert!(found_before.is_none());
}
