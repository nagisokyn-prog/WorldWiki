use worldwiki_calendar_core::age::calculate_age;
use worldwiki_calendar_core::astronomy::*;
use worldwiki_calendar_core::conversion::*;
use worldwiki_calendar_core::dial::*;
use worldwiki_calendar_core::eras::*;
use worldwiki_calendar_core::leap::*;
use worldwiki_calendar_core::holidays::*;
use worldwiki_calendar_core::seasons::*;
use worldwiki_calendar_core::types::*;
use worldwiki_calendar_core::weekdays::*;
use worldwiki_calendar_core::year_finder::year_from_days_o1;

#[test]
fn test_coverage_dial_all_branches() {
    // 1. dial_capacity
    assert_eq!(dial_capacity(&[24, 60, 60]), 86400);
    assert_eq!(dial_capacity(&[]), 0);
    assert_eq!(dial_capacity(&[0, -5]), 1);

    // 2. total_dial_subdivisions с некорректными/нулевыми единицами
    let h_invalid = DialHierarchy {
        units: vec![
            DialUnit { name: "A".into(), subdivisions: 0 },
            DialUnit { name: "B".into(), subdivisions: -10 },
        ],
    };
    assert_eq!(total_dial_subdivisions(&h_invalid), 1);

    // 3. units_to_day_tick граничные случаи
    let h_empty = DialHierarchy { units: vec![] };
    assert_eq!(units_to_day_tick(&[12], &h_empty, 86400), 0);
    assert_eq!(units_to_day_tick(&[], &h_invalid, 86400), 0);

    // 4. day_tick_to_units граничные случаи
    assert_eq!(day_tick_to_units(100, &h_empty, 86400), Vec::<i64>::new());
    assert_eq!(day_tick_to_units(100, &h_invalid, 86400), vec![0, 0]);
    assert_eq!(day_tick_to_units(100, &h_invalid, 0), vec![0, 0]);
}

#[test]
fn test_coverage_leap_all_functions_and_branches() {
    // 1. floor_div и rem_euclid
    assert_eq!(floor_div(10, 3), 3);
    assert_eq!(floor_div(-10, 3), -4);
    assert_eq!(rem_euclid(10, 3), 1);
    assert_eq!(rem_euclid(-10, 3), 2);

    // 2. drift_per_century (рациональная версия)
    let h = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
    ];
    let drift = drift_per_century(365, &h, 3652422, 10000);
    assert!(drift > 0.70 && drift < 0.85);
    // тропический знаменатель 0
    assert_eq!(drift_per_century(365, &h, 3652422, 0), 0.0);
    let zero_den = worldwiki_calendar_core::leap::RationalDrift { numerator_days: 10, denominator_years: 0 };
    assert_eq!(zero_den.to_milli_days_per_century(), 0);
    assert_eq!(zero_den.to_f64(), 0.0);

    // 3. days_in_month выход за границы
    let months = [30, 31];
    let target = LeapTarget::InMonth { target_month: 0 };
    assert_eq!(days_in_month(2000, 5, &months, &target, 1, &h), 0);

    // 4. days_in_month с LeapTarget::InExtraDays
    let extra_target = LeapTarget::InExtraDays;
    assert_eq!(days_in_month(2000, 0, &months, &extra_target, 1, &h), 30);

    // 5. validate_harmonics_lcm граничные ветки
    assert!(validate_harmonics_lcm(&[])); // пустой список

    // Огромный LCM > 100_000
    let huge_lcm_harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 1009, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 1013, weight: 1 },
    ];
    assert!(!validate_harmonics_lcm(&huge_lcm_harmonics));

    // Невалидный шаг (например, шаг 2 дня)
    let invalid_step = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 1, weight: 2 },
    ];
    assert!(!validate_harmonics_lcm(&invalid_step));
}

#[test]
fn test_coverage_astronomy_edge_cases_and_all_moon_phases() {
    // 1. Нулевой или отрицательный ticks_per_day
    assert_eq!(solar_noon_tick(0, 0, false), 0);
    assert_eq!(solar_noon_tick(-100, 0, false), 0);
    assert_eq!(solar_zenith_distance_mdeg(100, 0, 0, false), 0);
    assert_eq!(solar_zenith_distance_mdeg(100, -50, 0, false), 0);

    // 2. moon_phase_rational с некорректными делителями
    let (bp_zero, phase_zero) = moon_phase_rational(100, 0, 29, 1, 0);
    assert_eq!(bp_zero, 0);
    assert_eq!(phase_zero, MoonPhaseName::NewMoon);

    let (_, _) = moon_phase_rational(100, 86400, 0, 1, 0);
    let (_, _) = moon_phase_rational(100, 86400, 29, 0, 0);

    // 3. Проверка всех 8 секторов лунных фаз
    let test_phases = [
        (0, MoonPhaseName::NewMoon),
        (1000, MoonPhaseName::WaxingCrescent),
        (2500, MoonPhaseName::FirstQuarter),
        (3700, MoonPhaseName::WaxingGibbous),
        (5000, MoonPhaseName::FullMoon),
        (6200, MoonPhaseName::WaningGibbous),
        (7500, MoonPhaseName::LastQuarter),
        (8700, MoonPhaseName::WaningCrescent),
        (9600, MoonPhaseName::NewMoon), // Около 10000 снова NewMoon
    ];

    let t_day = 86400i64;
    for (target_bp, expected_phase) in test_phases {
        // Задаем период 1 день (86400 тиков) и сдвиг фазы target_bp
        let (bp, name) = moon_phase_rational(0, t_day, 1, 1, target_bp);
        assert_eq!(bp, target_bp);
        assert_eq!(name, expected_phase, "Mismatch for bp {target_bp}");
    }
}

#[test]
fn test_coverage_eras_all_branches() {
    // 1. era_contains_date с датой после окончания эры
    let closed_era = CoreEra {
        name: "OldEra".into(),
        start_year: 100,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(200),
        end_month: Some(12),
        end_day: Some(31),
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
    };
    assert!(!era_contains_date(&closed_era, 205, 1, 1));
    assert!(!era_contains_date(&closed_era, 50, 1, 1));

    // 2. find_active_era с пустым списком и датами вне диапазона
    assert_eq!(find_active_era(&[], 150, 1, 1), None);
    assert_eq!(find_active_era(core::slice::from_ref(&closed_era), 50, 1, 1), None);
    assert_eq!(find_active_era(core::slice::from_ref(&closed_era), 250, 1, 1), None);

    // 3. era_year_number с ByAnniversary и is_count_down: true
    let countdown_anniv_era = CoreEra {
        name: "CountDownAnniv".into(),
        start_year: 500,
        start_month: Some(6),
        start_day: Some(15),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: true,
        counting_mode: EraCountingMode::ByAnniversary,
    };
    // До годовщины в том же году
    assert_eq!(era_year_number(&countdown_anniv_era, 450, 5, 1, 31), 50);
    // После годовщины в том же году
    assert_eq!(era_year_number(&countdown_anniv_era, 450, 7, 1, 31), 51);

    // 4. era_year_number с ByAnniversary и is_count_down: false (до годовщины)
    let forward_anniv_era = CoreEra {
        name: "ForwardAnniv".into(),
        start_year: 500,
        start_month: Some(6),
        start_day: Some(15),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByAnniversary,
    };
    assert_eq!(era_year_number(&forward_anniv_era, 505, 5, 1, 31), 5);
    assert_eq!(era_year_number(&forward_anniv_era, 505, 7, 1, 31), 6);
}

#[test]
fn test_coverage_conversion_convert_calendar_date() {
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
        ],
    };
    let months = [30, 30, 30, 30];
    let harmonics: Vec<LeapHarmonic> = vec![];
    let eras = vec![
        CoreEra {
            name: "EraA".into(),
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

    let config_a = CalendarCultureConfig {
        planet_id: "earth",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 120,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &eras,
    };

    let config_b = CalendarCultureConfig {
        planet_id: "mars",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 120,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &eras,
    };

    let source_date = DateCoordinate {
        era_index: 0,
        year: 2,
        month: 1,
        day: 15,
        unit_values: vec![10, 20],
    };

    // Вызываем convert_calendar_date!
    let target_date = convert_calendar_date(&source_date, &config_a, &config_b);
    assert_eq!(target_date.year, 2);
    assert_eq!(target_date.month, 1);
    assert_eq!(target_date.day, 15);
    assert_eq!(target_date.unit_values, vec![10, 20]);

    // Календарь с пустым списком месяцев
    let config_no_months = CalendarCultureConfig {
        planet_id: "mars",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 120,
        regular_months: &[],
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &[],
    };
    let date_no_months = t_abs_to_date(100000, &config_no_months);
    assert_eq!(date_no_months.month, 0);
}

#[test]
fn test_coverage_year_finder_p_num_zero() {
    // p_num <= 0 ветка в year_from_days_o1
    let (y, d) = year_from_days_o1(100, 0, &[], 0);
    assert_eq!(y, 1);
    assert_eq!(d, 0);
}

#[test]
fn test_coverage_age_zero_max_days() {
    let rule = AgeRule::default();
    let birth = CalDate::new(2000, 5, 10);
    let current = CalDate::new(2020, 5, 10);
    // max_days_in_birth_month <= 0 ветка
    let age = calculate_age(birth, current, &rule, 0);
    assert_eq!(age, 20);
}

#[test]
fn test_coverage_leap_gcd_lcm_zero_edge_cases() {
    // leap.rs: строка 94 (a == 0 в gcd)
    assert_eq!(gcd(0, 0), 1);
    assert_eq!(gcd(0, 5), 5);
    assert_eq!(gcd(5, 0), 5);

    // leap.rs: строка 100 (a == 0 || b == 0 в lcm)
    assert_eq!(lcm(0, 10), 1);
    assert_eq!(lcm(10, 0), 1);
    assert_eq!(lcm(0, 0), 1);
    assert_eq!(lcm(4, 6), 12);
}

#[test]
fn test_coverage_dial_unit_subdivisions_zero_branch() {
    // dial.rs: строка 87 (else ветка когда sub <= 0 в day_tick_to_units)
    let hierarchy = DialHierarchy {
        units: vec![
            DialUnit { name: "hours".into(), subdivisions: 24 },
            DialUnit { name: "dead_scale".into(), subdivisions: 0 },
            DialUnit { name: "minutes".into(), subdivisions: 60 },
        ],
    };
    let units = day_tick_to_units(1000, &hierarchy, 86400);
    assert_eq!(units.len(), 3);
}

#[test]
fn test_coverage_conversion_epagomenal_days_past_all_months() {
    // conversion.rs: строка 107 (if m == total_months - 1 { month = m; })
    let months = [30, 30]; // Всего 60 дней в 2 месяцах
    let dial = DialHierarchy {
        units: vec![DialUnit { name: "tick".into(), subdivisions: 100 }],
    };
    let config = CalendarCultureConfig {
        planet_id: "test_planet",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 70, // В году 70 дней, т.е. дни 61..70 идут после 2-го месяца
        regular_months: &months,
        harmonics: &[],
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &[],
    };

    // cal_day = 65 (66-й день года 1, превышает сумму всех месяцев 60)
    let t_abs = 65 * 86400;
    let date = t_abs_to_date(t_abs, &config);
    // Должен попасть в последний месяц (m = 1) с днем 65 - 60 + 1 = 6
    assert_eq!(date.month, 1);
    assert_eq!(date.day, 6);
}

#[test]
fn test_coverage_year_finder_decrement_step() {
    // year_finder.rs: строки 34-36 (while days_up_to_year > d_cal { y -= 1; })
    let harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 3, divisor_c: 4, weight: 1 },
    ];
    // При base=365, d=4, shift_b=3: days_up_to_year(2) = 369 > 366
    let (year, day_in_year) = year_from_days_o1(366, 365, &harmonics, 4);
    assert_eq!(year, 1);
    assert_eq!(day_in_year, 366);
}

#[test]
fn test_coverage_astronomy_zenith_distance_half_day_wrap() {
    // astronomy.rs: строка 65 (circular_diff = ticks_per_day - diff когда diff > ticks_per_day / 2)
    // Долгота 90_000 mdeg смещает полдень: noon_base = 43200, offset = 21600 -> noon = 21600
    // При day_tick = 80000: diff = |80000 - 21600| = 58400 > 43200
    // circular_diff = 86400 - 58400 = 28000
    let zenith_mdeg = solar_zenith_distance_mdeg(80000, 86400, 90_000, false);
    assert!(zenith_mdeg > 0 && zenith_mdeg <= 180_000);

    let sunlight = sunlight_basis_points(80000, 86400, 90_000, false);
    assert_eq!(sunlight, 0); // Солнце глубоко под горизонтом ночью
}

#[test]
fn test_coverage_weekdays_zero_and_edge_branches() {
    assert_eq!(calculate_weekday(100, 0, 0, 0), 0);
    assert_eq!(calculate_weekday(100, 0, 0, 7), 2);

    let zero_cfg = WeekdayPauseConfig {
        days_in_regular_months: 360,
        extra_days_base: 5,
        extra_days_leap: 0,
        harmonics: &[],
        origin_year: 1,
        origin_day: 0,
        start_weekday: 0,
        weekdays_count: 0,
    };
    assert_eq!(calculate_weekday_with_pause(1, 0, &zero_cfg), Some(0));
}

#[test]
fn test_coverage_astronomy_daylight_zero_and_branches() {
    let zero_ticks_ctx = PlanetSunContext {
        solstice_world_day: 0,
        ticks_per_day: 0,
        tropical_year_num: 365,
        tropical_year_den: 1,
        summer_day_fraction_bp: 7000,
        winter_day_fraction_bp: 3000,
        is_north_hemisphere: true,
        longitude_mdeg: 0,
        retrograde: false,
    };
    let zero_ticks = calculate_daylight_and_sun_events(0, &zero_ticks_ctx);
    assert_eq!(zero_ticks.daylight_ticks, 0);

    let zero_year_ctx = PlanetSunContext {
        ticks_per_day: 86400,
        tropical_year_num: 0,
        ..zero_ticks_ctx
    };
    let zero_year = calculate_daylight_and_sun_events(0, &zero_year_ctx);
    assert_eq!(zero_year.daylight_ticks, 0);

    // Вторая половина года (year_fraction_bp >= 5000)
    let autumn_ctx = PlanetSunContext {
        tropical_year_num: 365,
        ..zero_year_ctx
    };
    let autumn = calculate_daylight_and_sun_events(270, &autumn_ctx);
    assert!(autumn.daylight_ticks > 0);
}

#[test]
fn test_coverage_holidays_and_month_rotation() {
    // 1. to_internal_month и to_cultural_month
    assert_eq!(to_internal_month(2, 2, 12), 0); // Март (индекс 2) становится месяцем 0
    assert_eq!(to_cultural_month(0, 2, 12), 2); // Восстановление
    assert_eq!(to_internal_month(5, 0, 0), 0);  // total_months == 0
    assert_eq!(to_cultural_month(5, 0, 0), 0);  // total_months == 0

    // 2. is_holiday_active: обычный диапазон внутри года (1 мая - 9 мая)
    assert!(is_holiday_active(4, 5, 4, 1, 4, 9));   // Внутри (5 мая)
    assert!(is_holiday_active(4, 1, 4, 1, 4, 9));   // Граница начала
    assert!(is_holiday_active(4, 9, 4, 1, 4, 9));   // Граница конца
    assert!(!is_holiday_active(4, 10, 4, 1, 4, 9)); // После
    assert!(!is_holiday_active(3, 30, 4, 1, 4, 9)); // До

    // 3. is_holiday_active: переход через Новый Год (25 декабря - 6 января)
    assert!(is_holiday_active(11, 28, 11, 25, 0, 6)); // Декабрь (28-е)
    assert!(is_holiday_active(0, 2, 11, 25, 0, 6));   // Январь (2-е)
    assert!(is_holiday_active(11, 25, 11, 25, 0, 6)); // Граница 25 дек
    assert!(is_holiday_active(0, 6, 11, 25, 0, 6));   // Граница 6 янв
    assert!(!is_holiday_active(5, 15, 11, 25, 0, 6)); // Летом не активно
}

#[test]
fn test_coverage_seasons_all_branches() {
    let summer = CoreSeason {
        name: "Summer".into(),
        color: "yellow".into(),
        months: vec![5, 6, 7],
    };
    let winter = CoreSeason {
        name: "Winter".into(),
        color: "blue".into(),
        months: vec![11, 0, 1],
    };
    let seasons = [summer.clone(), winter];

    // find_season_index
    assert_eq!(find_season_index(6, &seasons), Some(0)); // Summer
    assert_eq!(find_season_index(0, &seasons), Some(1)); // Winter
    assert_eq!(find_season_index(3, &seasons), None);    // Spring (нет в списке)

    // is_month_in_season
    assert!(is_month_in_season(6, &summer));
    assert!(!is_month_in_season(3, &summer));

    // is_season_conflicting_with_solstice
    // total_months == 0
    assert!(!is_season_conflicting_with_solstice(&[0], true, 0, 0));

    // Лето включает зимнее солнцестояние (месяц 0) -> конфликт!
    assert!(is_season_conflicting_with_solstice(&[0, 1], true, 0, 12));
    // Лето не включает зимнее солнцестояние -> нет конфликта
    assert!(!is_season_conflicting_with_solstice(&[5, 6], true, 0, 12));

    // Зима включает летнее солнцестояние (месяц 0 + 6 = 6) -> конфликт!
    assert!(is_season_conflicting_with_solstice(&[6, 7], false, 0, 12));
    // Зима не включает летнее солнцестояние -> нет конфликта
    assert!(!is_season_conflicting_with_solstice(&[11, 0], false, 0, 12));
}

#[test]
fn test_coverage_convergents_edge_cases() {
    use worldwiki_calendar_core::convergents::*;

    // 1. trop_den <= 0
    assert!(calculate_leap_convergents(365, 0, 5).is_empty());
    assert!(calculate_leap_convergents(365, -10, 5).is_empty());

    // 2. max_convergents == 0
    assert!(calculate_leap_convergents(3652422, 10000, 0).is_empty());

    // 3. frac_num == 0 (целое число дней в году)
    assert!(calculate_leap_convergents(365, 1, 5).is_empty());

    // 4. Валидное вычисление для тропического года
    let approx = calculate_leap_convergents(3652422, 10000, 3);
    assert_eq!(approx.len(), 3);
}


#[test]
fn test_coverage_linked_anchor_countdown_era() {
    let dial_24 = DialHierarchy {
        units: vec![DialUnit { name: "Hour".into(), subdivisions: 24 }],
    };
    let months = [30; 12];
    let harmonics = [];

    let master_config = CalendarCultureConfig {
        planet_id: "terra",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 360,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial_24,
        eras: &[],
    };

    // Локальный календарь с обратным отсчетом (is_count_down = true)
    let countdown_era = CoreEra {
        name: "Cataclysm Countdown".into(),
        start_year: 500,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(1000),
        end_month: Some(12),
        end_day: Some(30),
        is_count_down: true,
        counting_mode: EraCountingMode::ByCalendarYear,
    };
    let local_eras = [countdown_era];

    let local_config = CalendarCultureConfig {
        planet_id: "terra",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 360,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial_24,
        eras: &local_eras,
    };

    let master_date = DateCoordinate {
        era_index: 0,
        year: 100,
        month: 0,
        day: 1,
        unit_values: vec![0],
    };
    let local_date_countdown = DateCoordinate {
        era_index: 0, // era с is_count_down = true
        year: 10,
        month: 2,
        day: 5,
        unit_values: vec![0],
    };

    let anchor = calculate_linked_anchor_world_day(
        &master_date,
        &master_config,
        &local_date_countdown,
        &local_config,
    );
    assert!(anchor != 0);
}





