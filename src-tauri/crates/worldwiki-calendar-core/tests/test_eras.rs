use worldwiki_calendar_core::eras::*;
use worldwiki_calendar_core::types::{CoreEra, EraCountingMode};

#[test]
fn test_compare_dates() {
    assert_eq!(compare_dates(2020, 5, 10, 2020, 5, 10), core::cmp::Ordering::Equal);
    assert_eq!(compare_dates(2019, 5, 10, 2020, 5, 10), core::cmp::Ordering::Less);
    assert_eq!(compare_dates(2020, 4, 10, 2020, 5, 10), core::cmp::Ordering::Less);
    assert_eq!(compare_dates(2020, 5, 9, 2020, 5, 10), core::cmp::Ordering::Less);
    assert_eq!(compare_dates(2021, 1, 1, 2020, 12, 31), core::cmp::Ordering::Greater);
}

#[test]
fn test_find_active_era_binary_search() {
    let eras = vec![
        CoreEra {
            name: "Meiji".into(),
            start_year: 1868,
            start_month: Some(1),
            start_day: Some(25),
            end_year: Some(1912),
            end_month: Some(7),
            end_day: Some(30),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        },
        CoreEra {
            name: "Taisho".into(),
            start_year: 1912,
            start_month: Some(7),
            start_day: Some(30),
            end_year: Some(1926),
            end_month: Some(12),
            end_day: Some(25),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 1, // Тайсе имеет приоритет при смене дня
        },
        CoreEra {
            name: "Showa".into(),
            start_year: 1926,
            start_month: Some(12),
            start_day: Some(25),
            end_year: Some(1989),
            end_month: Some(1),
            end_day: Some(7),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 2,
        },
    ];

    // До первой эры
    assert_eq!(find_active_era(&eras, 1850, 1, 1), None);

    // Внутри Мэйдзи
    let active1 = find_active_era(&eras, 1870, 5, 1);
    assert_eq!(active1.map(|e| e.name.as_str()), Some("Meiji"));

    // День смены эры Мэйдзи -> Тайсе (30 июля 1912)
    let active_switch = find_active_era(&eras, 1912, 7, 30);
    assert_eq!(active_switch.map(|e| e.name.as_str()), Some("Taisho"));

    // Внутри Сева
    let active2 = find_active_era(&eras, 1945, 8, 15);
    assert_eq!(active2.map(|e| e.name.as_str()), Some("Showa"));
}

#[test]
fn test_era_year_number_coronation_leap_day() {
    // Интронизация в високосный день 29 февраля 2000 года
    let era = CoreEra {
        name: "LeapKing".into(),
        start_year: 2000,
        start_month: Some(2),
        start_day: Some(29),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByAnniversary,
        priority: 0,
    };

    // В 2000 году (год интронизации)
    assert_eq!(era_year_number(&era, 2000, 2, 29, 29), 1);
    assert_eq!(era_year_number(&era, 2000, 10, 1, 31), 1);

    // В 2001 году (невисокосный): в феврале 28 дней
    // 27 февраля - еще 1-й год правления
    assert_eq!(era_year_number(&era, 2001, 2, 27, 28), 1);
    // 28 февраля (clamped leap anniversary) - наступает 2-й год правления!
    assert_eq!(era_year_number(&era, 2001, 2, 28, 28), 2);
    // 1 марта - 2-й год правления
    assert_eq!(era_year_number(&era, 2001, 3, 1, 31), 2);
}

#[test]
fn test_era_validation_and_gaps() {
    // 8.4: Countdown без end_year
    let bad_countdown = CoreEra {
        name: "BadCountdown".into(),
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
    assert_eq!(
        validate_era(&bad_countdown, true),
        Err(EraValidationError::CountdownMissingEndYear)
    );

    // 8.3: Нетерминальная эра без end_year
    let bad_non_terminal = CoreEra {
        name: "BadNonTerminal".into(),
        start_year: 100,
        start_month: None,
        start_day: None,
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };
    assert_eq!(
        validate_era(&bad_non_terminal, false),
        Err(EraValidationError::OpenNonTerminalEra)
    );

    // 8.2: Разрыв между эрами (gap) возвращает None
    let eras_with_gap = vec![
        CoreEra {
            name: "First".into(),
            start_year: 100,
            start_month: Some(1),
            start_day: Some(1),
            end_year: Some(150),
            end_month: Some(12),
            end_day: Some(31),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        },
        CoreEra {
            name: "Second".into(),
            start_year: 200,
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

    // Год 175 находится в разрыве (151..199) -> None
    assert_eq!(find_active_era(&eras_with_gap, 175, 6, 1), None);
}

#[test]
fn test_era_year_zero_and_negative() {
    let era_zero = CoreEra {
        name: "ZeroEra".into(),
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
    assert_eq!(era_year_number(&era_zero, 1, 1, 1, 30), 2);

    let era_neg = CoreEra {
        name: "BCE".into(),
        start_year: -100,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };
    assert_eq!(era_year_number(&era_neg, -100, 1, 1, 30), 1);
    assert_eq!(era_year_number(&era_neg, -99, 1, 1, 30), 2);
}
