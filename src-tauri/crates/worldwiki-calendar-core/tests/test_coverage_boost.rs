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
        priority: 0,
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
        priority: 0,
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
        priority: 0,
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
            priority: 0,
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
        hemisphere: Hemisphere::Northern,
    };
    let winter = CoreSeason {
        name: "Winter".into(),
        color: "blue".into(),
        months: vec![11, 0, 1],
        hemisphere: Hemisphere::Northern,
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
        priority: 0,
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

#[test]
fn test_coverage_audit_full_branches() {
    use worldwiki_calendar_core::audit::*;

    let dial_24 = DialHierarchy {
        units: vec![DialUnit { name: "Hour".into(), subdivisions: 24 }],
    };
    let months = [30; 12];
    let harmonics = [LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 }];

    let config = CalendarCultureConfig {
        planet_id: "terra",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 1,
        calendar_origin_day: 0,
        dial: &dial_24,
        eras: &[],
    };

    // 1. generate_year_preview
    let preview1 = generate_year_preview(2024, &config, 0);
    assert_eq!(preview1.year, 2024);
    assert_eq!(preview1.months.len(), 12);
    let preview2 = generate_year_preview(2023, &config, 5);
    assert_eq!(preview2.year, 2023);

    // 2. audit_calendar_culture success
    let rep_ok = audit_calendar_culture(&config, 3652422, 10000);
    assert!(rep_ok.is_valid);
    assert!(rep_ok.errors.is_empty());

    // 3. audit warning: high drift (> 5000)
    let rep_drift = audit_calendar_culture(&config, 350, 1);
    assert!(!rep_drift.warnings.is_empty());

    // 4. audit warning: high lcm (> 500_000)
    let h_big_lcm = [
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 700, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 801, weight: 1 },
    ];
    let mut config_big_lcm = config.clone();
    config_big_lcm.harmonics = &h_big_lcm;
    let rep_lcm = audit_calendar_culture(&config_big_lcm, 365, 1);
    assert!(rep_lcm.warnings.iter().any(|w| w.contains("велик")));

    // 5. audit errors:
    // NonPositiveTicksPerDay
    let mut c_bad_ticks = config.clone();
    c_bad_ticks.ticks_per_day = 0;
    let rep = audit_calendar_culture(&c_bad_ticks, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("больше 0 тиков")));

    // DialTicksExceedsTicksPerDay
    let mut c_dial_overflow = config.clone();
    let dial_huge = DialHierarchy {
        units: vec![DialUnit { name: "Big".into(), subdivisions: 100_000 }],
    };
    c_dial_overflow.dial = &dial_huge;
    let rep = audit_calendar_culture(&c_dial_overflow, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("превышает общее число тиков")));

    // EmptyMonths
    let mut c_no_months = config.clone();
    c_no_months.regular_months = &[];
    let rep = audit_calendar_culture(&c_no_months, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("как минимум один месяц")));

    // NonPositiveDivisor
    let h_bad_div = [LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 0, weight: 1 }];
    let mut c_bad_h = config.clone();
    c_bad_h.harmonics = &h_bad_div;
    let rep = audit_calendar_culture(&c_bad_h, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("строго больше 0")));

    // DuplicateHarmonicDivisor
    let h_dup = [
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 2, shift_b: 0, divisor_c: 4, weight: 1 },
    ];
    let mut c_dup = config.clone();
    c_dup.harmonics = &h_dup;
    let rep = audit_calendar_culture(&c_dup, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("дубликат делителя")));

    // LcmExceedsLimit
    let h_huge_lcm = [
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 1009, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 1013, weight: 1 },
    ];
    let mut c_huge_lcm = config.clone();
    c_huge_lcm.harmonics = &h_huge_lcm;
    let rep = audit_calendar_culture(&c_huge_lcm, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("превышает вычислительный лимит")));

    // HarmonicsStepViolation
    let h_step_viol = [
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 1, weight: 2 },
    ];
    let mut c_step = config.clone();
    c_step.harmonics = &h_step_viol;
    let rep = audit_calendar_culture(&c_step, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("некорректный високосный шаг")));

    // NegativeLeapDays
    let mut c_neg_days = config.clone();
    c_neg_days.base_year_days = 0;
    c_neg_days.leap_day_offset = 0;
    let rep = audit_calendar_culture(&c_neg_days, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("не может быть неположительной")));

    // InvalidTargetMonth
    let mut c_target_m = config.clone();
    c_target_m.leap_target = LeapTarget::InMonth { target_month: 20 };
    let rep = audit_calendar_culture(&c_target_m, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("Целевой месяц")));

    // CountdownMissingEndYear
    let era_cd = [CoreEra {
        name: "CD".into(),
        start_year: 100,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: true,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    }];
    let mut c_era = config.clone();
    c_era.eras = &era_cd;
    let rep = audit_calendar_culture(&c_era, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("обратного отсчета обязана")));

    // OpenNonTerminalEra
    let era_open_non_term = [
        CoreEra {
            name: "First".into(),
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
        CoreEra {
            name: "Second".into(),
            start_year: 100,
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
    let mut c_open = config.clone();
    c_open.eras = &era_open_non_term;
    let rep = audit_calendar_culture(&c_open, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("Промежуточная эра обязана")));

    // EndBeforeStart
    let era_inverted = [CoreEra {
        name: "Bad".into(),
        start_year: 200,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(100),
        end_month: Some(1),
        end_day: Some(1),
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    }];
    let mut c_inv = config.clone();
    c_inv.eras = &era_inverted;
    let rep = audit_calendar_culture(&c_inv, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("предшествует дате начала")));

    // InvalidMonth (0)
    let era_zero_m = [CoreEra {
        name: "ZeroM".into(),
        start_year: 1,
        start_month: Some(0),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    }];
    let mut c_zm = config.clone();
    c_zm.eras = &era_zero_m;
    let rep = audit_calendar_culture(&c_zm, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("Некорректный месяц")));

    // InvalidDay (0)
    let era_zero_d = [CoreEra {
        name: "ZeroD".into(),
        start_year: 1,
        start_month: Some(1),
        start_day: Some(0),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    }];
    let mut c_zd = config.clone();
    c_zd.eras = &era_zero_d;
    let rep = audit_calendar_culture(&c_zd, 365, 1);
    assert!(rep.errors.iter().any(|e| e.contains("Некорректный день")));
}

#[test]
fn test_coverage_intervals_full_branches() {
    use worldwiki_calendar_core::intervals::*;

    // 1. interval_duration
    let iv_empty = TimeInterval { start: 100, end: 100 };
    assert_eq!(interval_duration(&iv_empty), 0);
    let iv_inv = TimeInterval { start: 150, end: 100 };
    assert_eq!(interval_duration(&iv_inv), 0);
    let iv_valid = TimeInterval { start: 50, end: 150 };
    assert_eq!(interval_duration(&iv_valid), 100);

    // 2. intervals_overlap
    let iv1 = TimeInterval { start: 10, end: 20 };
    let iv2 = TimeInterval { start: 15, end: 25 };
    let iv3 = TimeInterval { start: 20, end: 30 };
    assert!(intervals_overlap(&iv1, &iv2));
    assert!(!intervals_overlap(&iv1, &iv3)); // полуинтервалы [10, 20) и [20, 30) не пересекаются
    assert!(!intervals_overlap(&iv_empty, &iv1));
    assert!(!intervals_overlap(&iv1, &iv_empty));

    // 3. check_bilocation
    assert!(!check_bilocation(&iv1, "Tavern", &iv2, "Tavern")); // одна и та же локация - нет билокации
    assert!(check_bilocation(&iv1, "Tavern", &iv2, "Castle")); // разные локации + пересечение - билокация
    assert!(!check_bilocation(&iv1, "Tavern", &iv3, "Castle")); // нет пересечения

    // 4. check_bilocation_with_precision
    assert_eq!(
        check_bilocation_with_precision(&iv1, PrecisionLevel::ExactTick, "A", &iv2, PrecisionLevel::ExactTick, "A"),
        AnomalySeverity::None
    );
    assert_eq!(
        check_bilocation_with_precision(&iv1, PrecisionLevel::ExactTick, "A", &iv3, PrecisionLevel::ExactTick, "B"),
        AnomalySeverity::None
    );
    assert_eq!(
        check_bilocation_with_precision(&iv1, PrecisionLevel::Unknown, "A", &iv2, PrecisionLevel::ExactTick, "B"),
        AnomalySeverity::Suspect
    );
    assert_eq!(
        check_bilocation_with_precision(&iv1, PrecisionLevel::Day, "A", &iv2, PrecisionLevel::Unknown, "B"),
        AnomalySeverity::Suspect
    );
    assert_eq!(
        check_bilocation_with_precision(&iv1, PrecisionLevel::Hour, "A", &iv2, PrecisionLevel::Hour, "B"),
        AnomalySeverity::Violation
    );

    // 5. check_death_violation
    assert!(check_death_violation(&TimeInterval { start: 110, end: 120 }, 100));
    assert!(check_death_violation(&TimeInterval { start: 90, end: 110 }, 100));
    assert!(!check_death_violation(&TimeInterval { start: 80, end: 95 }, 100));

    // 6. check_lifecycle_anomaly
    assert_eq!(check_lifecycle_anomaly(100, 50), AnomalySeverity::Violation);
    assert_eq!(check_lifecycle_anomaly(100, 100), AnomalySeverity::None);
    assert_eq!(check_lifecycle_anomaly(100, 150), AnomalySeverity::None);

    // 7. check_incremental_bilocation
    let modified = SceneIntervalEntry {
        scene_id: "s1",
        character_id: "hero",
        location_id: "Castle",
        interval: TimeInterval { start: 10, end: 20 },
        precision: PrecisionLevel::ExactTick,
    };
    let scenes = vec![
        SceneIntervalEntry {
            scene_id: "s1", // same id -> skip
            character_id: "hero",
            location_id: "Castle",
            interval: TimeInterval { start: 10, end: 20 },
            precision: PrecisionLevel::ExactTick,
        },
        SceneIntervalEntry {
            scene_id: "s2",
            character_id: "villain", // different character -> skip
            location_id: "Tavern",
            interval: TimeInterval { start: 15, end: 25 },
            precision: PrecisionLevel::ExactTick,
        },
        SceneIntervalEntry {
            scene_id: "s3",
            character_id: "hero",
            location_id: "Tavern", // different location + overlap -> violation
            interval: TimeInterval { start: 15, end: 25 },
            precision: PrecisionLevel::ExactTick,
        },
    ];
    let anomalies = check_incremental_bilocation(&modified, &scenes);
    assert_eq!(anomalies.len(), 1);
    assert_eq!(anomalies[0].0, "s3");
    assert_eq!(anomalies[0].1, AnomalySeverity::Violation);
}

#[test]
fn test_coverage_types_full_branches() {
    // 1. PlanetId
    let p_ok = PlanetId::new("mars").expect("Valid PlanetId");
    assert_eq!(p_ok.as_str(), "mars");
    assert_eq!(&*p_ok, "mars");
    assert!(PlanetId::new("").is_err());
    assert!(PlanetId::new("   ").is_err());

    // 2. CalendarId
    let c_ok = CalendarId::new("standard").expect("Valid CalendarId");
    assert_eq!(c_ok.as_str(), "standard");
    assert_eq!(&*c_ok, "standard");
    assert!(CalendarId::new("").is_err());
    assert!(CalendarId::new(" \t ").is_err());

    // 3. CalDate
    let cd = CalDate::new(2026, 10, 16);
    assert_eq!(cd.year, 2026);
    assert_eq!(cd.month, 10);
    assert_eq!(cd.day, 16);

    // 4. validate_unique_weekdays
    let w_unique = vec!["Mon".into(), "Tue".into(), "Wed".into()];
    assert!(validate_unique_weekdays(&w_unique).is_ok());
    let w_dup = vec!["Mon".into(), "Tue".into(), "Mon".into()];
    assert!(validate_unique_weekdays(&w_dup).is_err());

    // 5. sanitize_moon_ids
    let active = ["luna", "phobos"];
    let mut configured = vec!["luna".into(), "orphan_moon".into(), "phobos".into()];
    sanitize_moon_ids(&active, &mut configured);
    assert_eq!(configured, vec!["luna".to_string(), "phobos".to_string()]);

    // 6. EraCountingMode serde
    #[cfg(feature = "serde")]
    {
        let json_cal = serde_json::to_string(&EraCountingMode::ByCalendarYear).unwrap();
        let de_cal: EraCountingMode = serde_json::from_str(&json_cal).unwrap();
        assert_eq!(de_cal, EraCountingMode::ByCalendarYear);

        let json_ann = serde_json::to_string(&EraCountingMode::ByAnniversary).unwrap();
        let de_ann: EraCountingMode = serde_json::from_str(&json_ann).unwrap();
        assert_eq!(de_ann, EraCountingMode::ByAnniversary);

        let de_unk: EraCountingMode = serde_json::from_str("\"unknown_future_mode\"").unwrap();
        assert_eq!(de_unk, EraCountingMode::Unknown);
    }
}

#[test]
fn test_coverage_moons_full_branches() {
    use worldwiki_calendar_core::moons::*;

    // 1. MoonConfig::validate
    let m_valid = MoonConfig {
        name: "Luna".into(),
        period_days_num: 28,
        period_days_den: 1,
        initial_phase_bp: 5000,
    };
    assert!(m_valid.validate().is_ok());

    let mut m_invalid = m_valid.clone();
    m_invalid.period_days_num = 0;
    assert_eq!(m_invalid.validate(), Err(MoonValidationError::NonPositivePeriod));

    let mut m_invalid2 = m_valid.clone();
    m_invalid2.period_days_den = 0;
    assert_eq!(m_invalid2.validate(), Err(MoonValidationError::NonPositivePeriod));

    let mut m_invalid3 = m_valid.clone();
    m_invalid3.initial_phase_bp = -1;
    assert_eq!(m_invalid3.validate(), Err(MoonValidationError::InvalidPhaseBasisPoints));

    let mut m_invalid4 = m_valid.clone();
    m_invalid4.initial_phase_bp = 10_000;
    assert_eq!(m_invalid4.validate(), Err(MoonValidationError::InvalidPhaseBasisPoints));

    // 2. moon_phase_rational boundary values
    assert_eq!(moon_phase_rational(0, 0, 28, 1, 0), (0, MoonPhaseName::NewMoon));
    assert_eq!(moon_phase_rational(0, 86400, 0, 1, 0), (0, MoonPhaseName::NewMoon));
    assert_eq!(moon_phase_rational(0, 86400, 28, 0, 0), (0, MoonPhaseName::NewMoon));

    // All 8 sectors
    let (_, p_new) = moon_phase_rational(0, 86400, 10, 1, 0); // 0 bp
    assert_eq!(p_new, MoonPhaseName::NewMoon);
    let (_, p_wax_cresc) = moon_phase_rational(0, 86400, 10, 1, 1000); // 1000 bp
    assert_eq!(p_wax_cresc, MoonPhaseName::WaxingCrescent);
    let (_, p_first_q) = moon_phase_rational(0, 86400, 10, 1, 2500); // 2500 bp
    assert_eq!(p_first_q, MoonPhaseName::FirstQuarter);
    let (_, p_wax_gibb) = moon_phase_rational(0, 86400, 10, 1, 3500); // 3500 bp
    assert_eq!(p_wax_gibb, MoonPhaseName::WaxingGibbous);
    let (_, p_full) = moon_phase_rational(0, 86400, 10, 1, 5000); // 5000 bp
    assert_eq!(p_full, MoonPhaseName::FullMoon);
    let (_, p_wan_gibb) = moon_phase_rational(0, 86400, 10, 1, 6000); // 6000 bp
    assert_eq!(p_wan_gibb, MoonPhaseName::WaningGibbous);
    let (_, p_last_q) = moon_phase_rational(0, 86400, 10, 1, 7500); // 7500 bp
    assert_eq!(p_last_q, MoonPhaseName::LastQuarter);
    let (_, p_wan_cresc) = moon_phase_rational(0, 86400, 10, 1, 8500); // 8500 bp
    assert_eq!(p_wan_cresc, MoonPhaseName::WaningCrescent);
    let (_, p_new_end) = moon_phase_rational(0, 86400, 10, 1, 9500); // 9500 bp
    assert_eq!(p_new_end, MoonPhaseName::NewMoon);

    // 3. moon_phase_exact
    let (bp_exact, _) = moon_phase_exact(0, 86400, 10, 1, 1, 2);
    assert_eq!(bp_exact, 5000);
    let (bp_exact_zero, _) = moon_phase_exact(0, 86400, 10, 1, 1, 0); // zero den
    assert_eq!(bp_exact_zero, 0);

    // 4. find_next_double_full_moon
    let m1 = MoonConfig {
        name: "M1".into(),
        period_days_num: 10,
        period_days_den: 1,
        initial_phase_bp: 5000, // starting at full moon
    };
    let m2 = MoonConfig {
        name: "M2".into(),
        period_days_num: 20,
        period_days_den: 1,
        initial_phase_bp: 5000, // starting at full moon
    };
    assert_eq!(find_next_double_full_moon(&m1, &m2, 86400, 0, 5), Some(0));
    assert_eq!(find_next_double_full_moon(&m1, &m2, 0, 0, 5), None); // ticks_per_day <= 0
    assert_eq!(find_next_double_full_moon(&m_invalid, &m2, 86400, 0, 5), None); // invalid moon1

    let m3 = MoonConfig {
        name: "M3".into(),
        period_days_num: 100,
        period_days_den: 1,
        initial_phase_bp: 0,
    };
    assert_eq!(find_next_double_full_moon(&m1, &m3, 86400, 0, 1), None); // not found within 1 day

    // 5. calculate_all_moon_phases
    let list = calculate_all_moon_phases(0, 86400, &[m1, m2]);
    assert_eq!(list.len(), 2);
}

#[test]
fn test_coverage_holidays_full_branches() {
    use worldwiki_calendar_core::holidays::*;

    // 1. to_internal_month and to_cultural_month
    assert_eq!(to_internal_month(5, 0, 0), 0); // total_months == 0
    assert_eq!(to_internal_month(12, 0, 12), 12); // epagomenal cultural_m >= total_months
    assert_eq!(to_cultural_month(5, 0, 0), 0);
    assert_eq!(to_cultural_month(12, 0, 12), 12); // epagomenal

    // 2. is_multi_year_holiday_active
    let annual = CoreHoliday {
        name: "New Year".into(),
        start_month: 0,
        start_day: 1,
        end_month: 0,
        end_day: 5,
        start_year: None,
        duration_years: 0,
    };
    assert!(is_multi_year_holiday_active(2026, 0, 3, &annual));
    assert!(!is_multi_year_holiday_active(2026, 0, 10, &annual));

    let multi = CoreHoliday {
        name: "Reign Jubileum".into(),
        start_month: 5,
        start_day: 10,
        end_month: 8,
        end_day: 20,
        start_year: Some(2020),
        duration_years: 3, // ends in 2023
    };
    assert!(!is_multi_year_holiday_active(2019, 6, 1, &multi)); // before start year
    assert!(!is_multi_year_holiday_active(2024, 6, 1, &multi)); // after end year
    assert!(!is_multi_year_holiday_active(2020, 5, 5, &multi)); // start year, before day
    assert!(is_multi_year_holiday_active(2020, 5, 15, &multi)); // start year, after day
    assert!(is_multi_year_holiday_active(2021, 1, 1, &multi)); // middle year
    assert!(!is_multi_year_holiday_active(2023, 8, 25, &multi)); // end year, after day
    assert!(is_multi_year_holiday_active(2023, 8, 15, &multi)); // end year, before day
}

#[test]
fn test_coverage_seasons_full_branches() {
    use worldwiki_calendar_core::seasons::*;

    // 1. solstice_day_in_year_to_calendar_month overflow
    let months = [30, 30, 30];
    assert_eq!(solstice_day_in_year_to_calendar_month(150, &months), 2); // clamped to last month

    // 2. find_season_index
    let seasons = vec![
        CoreSeason {
            name: "Spring".into(),
            color: "green".into(),
            months: vec![2, 3],
            hemisphere: Hemisphere::Northern,
        },
    ];
    assert_eq!(find_season_index(2, &seasons), Some(0));
    assert_eq!(find_season_index(10, &seasons), None);

    // 3. is_month_in_season
    assert!(is_month_in_season(2, &seasons[0]));
    assert!(!is_month_in_season(5, &seasons[0]));

    // 4. is_season_conflicting_with_solstice_hemisphere
    assert!(!is_season_conflicting_with_solstice_hemisphere(&[0], true, 0, 0, Hemisphere::Northern)); // total_months == 0

    // Northern hemisphere: winter month = 0, summer month = 6 (in 12 months)
    assert!(is_season_conflicting_with_solstice_hemisphere(&[0, 1], true, 0, 12, Hemisphere::Northern)); // summer contains winter -> conflict
    assert!(!is_season_conflicting_with_solstice_hemisphere(&[5, 6], true, 0, 12, Hemisphere::Northern)); // summer contains summer -> ok
    assert!(is_season_conflicting_with_solstice_hemisphere(&[6], false, 0, 12, Hemisphere::Northern)); // non-summer contains summer -> conflict

    // Southern hemisphere: winter month = (0 + 6) % 12 = 6, summer month = 0
    assert!(is_season_conflicting_with_solstice_hemisphere(&[6], true, 0, 12, Hemisphere::Southern)); // summer contains southern winter -> conflict
    assert!(!is_season_conflicting_with_solstice_hemisphere(&[0], true, 0, 12, Hemisphere::Southern)); // summer contains southern summer -> ok

    // is_season_conflicting_with_solstice (North default wrapper)
    assert!(is_season_conflicting_with_solstice(&[0], true, 0, 12));
}

#[test]
fn test_coverage_sync_full_branches() {
    use worldwiki_calendar_core::sync::*;

    // 1. resolve_sync_chain cycle detection
    let res_cycle = resolve_sync_chain("cal_a", |id| {
        match id {
            "cal_a" => Ok(Some("cal_b")),
            "cal_b" => Ok(Some("cal_a")),
            _ => Ok(None),
        }
    });
    assert_eq!(res_cycle, Err(ConversionError::CyclicSyncDependency));

    // 2. resolve_sync_chain max depth exceeded
    let res_depth = resolve_sync_chain("cal_1", |id| {
        match id {
            "cal_1" => Ok(Some("cal_2")),
            "cal_2" => Ok(Some("cal_3")),
            "cal_3" => Ok(Some("cal_4")),
            "cal_4" => Ok(Some("cal_5")),
            "cal_5" => Ok(Some("cal_6")),
            "cal_6" => Ok(Some("cal_7")),
            "cal_7" => Ok(Some("cal_8")),
            "cal_8" => Ok(Some("cal_9")),
            "cal_9" => Ok(Some("cal_10")),
            _ => Ok(None),
        }
    });
    assert_eq!(res_depth, Err(ConversionError::MaxChainDepthExceeded));

    // 3. resolve_sync_chain master not found
    let res_err = resolve_sync_chain("cal_x", |_| Err(ConversionError::MasterCalendarNotFound));
    assert_eq!(res_err, Err(ConversionError::MasterCalendarNotFound));

    // 4. resolve_sync_chain success
    let res_ok = resolve_sync_chain("local", |id| {
        if id == "local" {
            Ok(Some("master"))
        } else {
            Ok(None)
        }
    });
    assert_eq!(res_ok, Ok("master"));

    // 5. try_calculate_linked_anchor_world_day invalid dates
    let dial_24 = DialHierarchy {
        units: vec![DialUnit { name: "Hour".into(), subdivisions: 24 }],
    };
    let months = [30; 12];
    let config = CalendarCultureConfig {
        planet_id: "terra",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 360,
        regular_months: &months,
        harmonics: &[],
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial_24,
        eras: &[],
    };

    let bad_source = DateCoordinate {
        era_index: 0,
        year: 1,
        month: 50, // invalid month
        day: 1,
        unit_values: vec![0],
    };
    let good_date = DateCoordinate {
        era_index: 0,
        year: 1,
        month: 0,
        day: 1,
        unit_values: vec![0],
    };
    let bad_target = DateCoordinate {
        era_index: 0,
        year: 1,
        month: 0,
        day: 50, // invalid day
        unit_values: vec![0],
    };

    assert_eq!(
        try_calculate_linked_anchor_world_day(&bad_source, &config, &good_date, &config),
        Err(ConversionError::InvalidSourceDate)
    );
    assert_eq!(
        try_calculate_linked_anchor_world_day(&good_date, &config, &bad_target, &config),
        Err(ConversionError::InvalidTargetDate)
    );
    assert!(try_calculate_linked_anchor_world_day(&good_date, &config, &good_date, &config).is_ok());
}

#[test]
fn test_coverage_conversion_and_eras_full_branches() {
    let dial_24 = DialHierarchy {
        units: vec![DialUnit { name: "Hour".into(), subdivisions: 24 }],
    };
    let months = [30; 12];
    let config = CalendarCultureConfig {
        planet_id: "terra",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 360,
        regular_months: &months,
        harmonics: &[],
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial_24,
        eras: &[],
    };

    // 1. validate_date_coordinate
    let mut c_empty = config.clone();
    c_empty.regular_months = &[];
    let d1 = DateCoordinate { era_index: 0, year: 1, month: 0, day: 1, unit_values: vec![] };
    assert_eq!(validate_date_coordinate(&d1, &c_empty), Err(ConversionError::MonthOutOfBounds));

    let d_bad_m = DateCoordinate { era_index: 0, year: 1, month: 15, day: 1, unit_values: vec![] };
    assert_eq!(validate_date_coordinate(&d_bad_m, &config), Err(ConversionError::MonthOutOfBounds));

    let d_day_0 = DateCoordinate { era_index: 0, year: 1, month: 0, day: 0, unit_values: vec![] };
    assert_eq!(validate_date_coordinate(&d_day_0, &config), Err(ConversionError::DayOutOfBounds));

    let d_day_too_big = DateCoordinate { era_index: 0, year: 1, month: 0, day: 31, unit_values: vec![] };
    assert_eq!(validate_date_coordinate(&d_day_too_big, &config), Err(ConversionError::DayOutOfBounds));

    // 2. try_convert_calendar_date
    assert!(try_convert_calendar_date(&d_day_0, &config, &config).is_err());
    assert!(try_convert_calendar_date(&d1, &config, &config).is_ok());

    // 3. validate_era
    let era_end_before_start = CoreEra {
        name: "E1".into(),
        start_year: 100,
        start_month: Some(5),
        start_day: Some(10),
        end_year: Some(100),
        end_month: Some(5),
        end_day: Some(5),
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };
    assert_eq!(validate_era(&era_end_before_start, true), Err(EraValidationError::EndBeforeStart));

    let era_end_m_0 = CoreEra {
        name: "E2".into(),
        start_year: 100,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(200),
        end_month: Some(0),
        end_day: Some(1),
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };
    assert_eq!(validate_era(&era_end_m_0, true), Err(EraValidationError::InvalidMonth));

    let era_end_d_0 = CoreEra {
        name: "E3".into(),
        start_year: 100,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(200),
        end_month: Some(1),
        end_day: Some(0),
        is_count_down: false,
        counting_mode: EraCountingMode::ByCalendarYear,
        priority: 0,
    };
    assert_eq!(validate_era(&era_end_d_0, true), Err(EraValidationError::InvalidDay));

    // 4. sort_eras
    let mut eras_to_sort = vec![
        CoreEra {
            name: "Early".into(),
            start_year: 100,
            start_month: Some(1),
            start_day: Some(1),
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 5,
        },
        CoreEra {
            name: "High Priority Same Date".into(),
            start_year: 100,
            start_month: Some(1),
            start_day: Some(1),
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 20,
        },
        CoreEra {
            name: "Oldest".into(),
            start_year: 50,
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
    sort_eras(&mut eras_to_sort);
    assert_eq!(eras_to_sort[0].name, "Oldest");
    assert_eq!(eras_to_sort[1].name, "High Priority Same Date");

    // 5. find_active_era
    assert!(find_active_era(&[], 100, 1, 1).is_none());

    let eras_tie = [
        CoreEra {
            name: "EraEarlier".into(),
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
        CoreEra {
            name: "EraLater".into(),
            start_year: 150,
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
    let chosen_tie = find_active_era(&eras_tie, 160, 1, 1).unwrap();
    assert_eq!(chosen_tie.name, "EraLater");
    assert!(find_active_era(&eras_tie, 300, 1, 1).is_none()); // gap outside all eras

    let eras_tie_none = [
        CoreEra {
            name: "EraNone".into(),
            start_year: 100,
            start_month: None,
            start_day: None,
            end_year: Some(200),
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 10,
        },
        CoreEra {
            name: "EraMonth2".into(),
            start_year: 100,
            start_month: Some(2),
            start_day: Some(1),
            end_year: Some(200),
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 10,
        },
    ];
    let chosen_tie_none = find_active_era(&eras_tie_none, 100, 2, 5).unwrap();
    assert_eq!(chosen_tie_none.name, "EraMonth2");

    // 6. era_year_number ByAnniversary countdown
    let era_ann_cd = CoreEra {
        name: "AnnCD".into(),
        start_year: 100,
        start_month: Some(6),
        start_day: Some(15),
        end_year: Some(200),
        end_month: Some(12),
        end_day: Some(31),
        is_count_down: true,
        counting_mode: EraCountingMode::ByAnniversary,
        priority: 0,
    };
    // before anniversary in year
    assert_eq!(era_year_number(&era_ann_cd, 150, 5, 1, 30), 50);
    // after anniversary in year
    assert_eq!(era_year_number(&era_ann_cd, 150, 7, 1, 30), 51);

    // ByAnniversary standard count up: before month
    let era_ann_up = CoreEra {
        name: "AnnUp".into(),
        start_year: 100,
        start_month: Some(6),
        start_day: Some(15),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByAnniversary,
        priority: 0,
    };
    assert_eq!(era_year_number(&era_ann_up, 105, 3, 1, 30), 5); // month < start_m

    // Unknown mode
    let era_unk = CoreEra {
        name: "Unk".into(),
        start_year: 100,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::Unknown,
        priority: 0,
    };
    assert_eq!(era_year_number(&era_unk, 105, 1, 1, 30), 6);
}

#[test]
fn test_coverage_astronomy_and_scalar_full_branches() {
    use worldwiki_calendar_core::astronomy::*;
    use worldwiki_calendar_core::scalar::*;

    // 1. solar_noon_tick with ticks_per_day <= 0
    assert_eq!(solar_noon_tick(0, 0, false), 0);
    assert_eq!(solar_zenith_distance_mdeg(0, 0, 0, false), 0);

    // 2. sunlight_basis_points
    assert_eq!(sunlight_basis_points(0, 86400, 0, false), 0); // midnight -> 0 bp
    assert!(sunlight_basis_points(43200, 86400, 0, false) > 0); // noon -> > 0 bp

    // 3. calculate_daylight_and_sun_events with zero params
    let ctx_zero = PlanetSunContext {
        solstice_world_day: 0,
        ticks_per_day: 0,
        tropical_year_num: 365,
        tropical_year_den: 1,
        summer_day_fraction_bp: 5000,
        winter_day_fraction_bp: 5000,
        is_north_hemisphere: true,
        longitude_mdeg: 0,
        retrograde: false,
    };
    let ev = calculate_daylight_and_sun_events(0, &ctx_zero);
    assert_eq!(ev.daylight_ticks, 0);

    // 4. SunEvents polar checks
    let ev_polar_day = SunEvents { daylight_ticks: 86400, noon_tick: 43200, sunrise_tick: 0, sunset_tick: 0 };
    assert!(ev_polar_day.is_polar_day(86400));
    assert!(!ev_polar_day.is_polar_night());

    let ev_polar_night = SunEvents { daylight_ticks: 0, noon_tick: 43200, sunrise_tick: 0, sunset_tick: 0 };
    assert!(ev_polar_night.is_polar_night());
    assert!(!ev_polar_night.is_polar_day(86400));

    // 5. validate_t_abs_bound
    assert!(!validate_t_abs_bound(i64::MIN));
    assert!(!validate_t_abs_bound(i64::MAX));
    assert!(validate_t_abs_bound(0));

    // 6. normalize_day_start_offset
    assert_eq!(normalize_day_start_offset(100, 0), 0);

    // 7. try_t_abs_to_local_moment
    assert_eq!(try_t_abs_to_local_moment(0, "p", 0, 0), Err(ScalarError::DivisionByZero));

    // 8. revert_day_start_offset
    assert_eq!(revert_day_start_offset(100, 20, 86400), 80);

    // 9. FastLocalMoment
    let key = PlanetKey(1);
    let fast_m = t_abs_to_fast_moment(1000, key, 86400, 100);
    let t_restored = fast_moment_to_t_abs(fast_m, 86400, 100);
    assert_eq!(t_restored, 1000);
}

#[test]
fn test_coverage_100_percent_final_sweep() {
    use worldwiki_calendar_core::convergents::*;
    use worldwiki_calendar_core::conversion::*;
    use worldwiki_calendar_core::dial::*;
    use worldwiki_calendar_core::drift::*;
    use worldwiki_calendar_core::eras::*;
    use worldwiki_calendar_core::intervals::*;
    use worldwiki_calendar_core::leap::*;
    use worldwiki_calendar_core::scalar::*;
    use worldwiki_calendar_core::seasons::*;
    use worldwiki_calendar_core::types::*;
    use worldwiki_calendar_core::year_finder::*;

    // 1. SCALAR: Error formatting & fallback with ticks_per_day == 0
    assert_eq!(ScalarError::Overflow, ScalarError::Overflow.clone());
    assert_ne!(ScalarError::Overflow, ScalarError::DivisionByZero);
    assert!(format!("{:?}", ScalarError::DivisionByZero).contains("DivisionByZero"));

    let mom_zero = t_abs_to_local_moment(100, "planet", 0, 0);
    assert_eq!(mom_zero.world_day, 100);
    let mom_zero_offset = t_abs_to_local_moment(100, "planet", 0, 50);
    assert_eq!(mom_zero_offset.world_day, 50);

    let fast_zero = t_abs_to_fast_moment(100, PlanetKey(2), 0, 0);
    assert_eq!(fast_zero.world_day, 100);

    // 2. DIAL: validate_dial_hierarchy Ok, bijective zero checks, checked_total_dial_subdivisions branches
    let h_ok = DialHierarchy {
        units: vec![
            DialUnit { name: "hour".into(), subdivisions: 24 },
            DialUnit { name: "min".into(), subdivisions: 60 },
        ],
    };
    assert_eq!(validate_dial_hierarchy(&h_ok), Ok(()));
    assert!(!is_dial_strictly_bijective(&h_ok, 0));
    assert_eq!(dial_quantum_remainder(&h_ok, 0), 0);

    let h_empty = DialHierarchy { units: vec![] };
    assert_eq!(checked_total_dial_subdivisions(&h_empty), Ok(0));

    let h_neg = DialHierarchy {
        units: vec![DialUnit { name: "sec".into(), subdivisions: -10 }],
    };
    assert_eq!(checked_total_dial_subdivisions(&h_neg), Err(DialError::ZeroOrNegativeSubdivision));

    let h_ovf = DialHierarchy {
        units: vec![
            DialUnit { name: "u1".into(), subdivisions: i64::MAX },
            DialUnit { name: "u2".into(), subdivisions: 2 },
        ],
    };
    assert_eq!(checked_total_dial_subdivisions(&h_ovf), Err(DialError::CapacityOverflow));

    assert_eq!(DialError::CapacityOverflow, DialError::CapacityOverflow.clone());
    assert!(format!("{:?}", DialError::ZeroOrNegativeSubdivision).contains("ZeroOrNegativeSubdivision"));

    // 3. CONVERGENTS: calculate_leap_convergents and LeapApproximation
    let conv = calculate_leap_convergents(1, 3, 5);
    assert!(!conv.is_empty());
    let conv_huge = calculate_leap_convergents(i64::MAX - 1, i64::MAX, 10);
    assert!(!conv_huge.is_empty());

    let approx = LeapApproximation { leap_years: 1, cycle_years: 4 };
    assert_eq!(approx, approx.clone());
    assert!(format!("{:?}", approx).contains("LeapApproximation"));

    // 4. SYNC: resolve_sync_chain error propagation
    let err_sync = resolve_sync_chain("child", |_| Err(ConversionError::MasterCalendarNotFound));
    assert_eq!(err_sync, Err(ConversionError::MasterCalendarNotFound));

    // 5. YEAR FINDER: line 83 d_cal / base execution in year_from_days_o1
    let bad_harmonics = vec![LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 1, weight: 1 }];
    let (y_approx, _) = year_from_days_o1(100, 10, &bad_harmonics, -20);
    assert_eq!(y_approx, 10);

    assert_eq!(YearFinderError::CorrectionExceeded, YearFinderError::CorrectionExceeded.clone());
    assert!(format!("{:?}", YearFinderError::NonPositiveMeanYearLength).contains("NonPositiveMeanYearLength"));

    // 6. DRIFT: gcd(0,0), lcm(1,0), divisor_c <= 0 in harmonics
    assert_eq!(gcd(0, 0), 1);
    assert_eq!(lcm(1, 0), 1);
    assert_eq!(lcm(0, 1), 1);

    let h_nonpos = vec![LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: -4, weight: 1 }];
    assert_eq!(harmonics_lcm(&h_nonpos), 1);
    let d_rat = drift_per_century_rational(365, &h_nonpos, 365, 1);
    assert_eq!(d_rat.numerator_days, 0);

    let h_zero = vec![LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 0, weight: 1 }];
    assert_eq!(drift_per_century_f64(365, &h_zero, 365.0), 0.0);

    let rd = RationalDrift { numerator_days: 1, denominator_years: 4 };
    assert_eq!(rd, rd.clone());
    assert!(format!("{:?}", rd).contains("RationalDrift"));

    // 7. SEASONS: solstice_day_in_year_to_calendar_month early return and enums
    let s_idx = solstice_day_in_year_to_calendar_month(15, &[30, 30, 30]);
    assert_eq!(s_idx, 0);

    let cs = CoreSeason {
        name: "Winter".into(),
        color: "#ffffff".into(),
        months: vec![0, 1],
        hemisphere: Hemisphere::Northern,
    };
    assert_eq!(cs, cs.clone());
    assert_eq!(Hemisphere::default(), Hemisphere::Northern);
    assert_eq!(Hemisphere::Northern, Hemisphere::Northern.clone());
    assert!(format!("{:?}", cs).contains("Winter"));

    // 8. LEAP: days_up_to_month_with_prefix leap addition & validate_harmonics_step(&[])
    let prefix = vec![0, 31, 59, 90, 120, 151];
    let target = LeapTarget::InMonth { target_month: 1 };
    let h_leap = vec![LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 }];
    let d_prefix = days_up_to_month_with_prefix(2000, 3, &prefix, &target, 1, &h_leap);
    assert_eq!(d_prefix, 91);

    assert_eq!(validate_harmonics_step(&[]), Ok(()));

    assert_eq!(LeapValidationError::NegativeLeapDays, LeapValidationError::NegativeLeapDays.clone());
    assert!(format!("{:?}", LeapValidationError::InvalidTargetMonth).contains("InvalidTargetMonth"));

    // 9. CONVERSION: DialTicksExceedsTicksPerDay from invalid dial & reverse era coordinate validation
    let dial_bad = DialHierarchy {
        units: vec![DialUnit { name: "u".into(), subdivisions: -1 }],
    };
    let eras_single = vec![CoreEra {
        name: "Era 1".into(),
        start_year: 1,
        start_month: Some(1),
        start_day: Some(1),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        priority: 1,
        counting_mode: EraCountingMode::ByCalendarYear,
    }];
    let cfg_bad_dial = CalendarCultureConfig {
        planet_id: "planet",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: &[30, 31],
        harmonics: &[],
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial_bad,
        eras: &eras_single,
    };
    assert_eq!(
        validate_calendar_config(&cfg_bad_dial),
        Err(CalendarConfigValidationError::DialTicksExceedsTicksPerDay)
    );

    let era_cd = CoreEra {
        name: "Countdown".into(),
        start_year: 100,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(150),
        end_month: Some(12),
        end_day: Some(31),
        is_count_down: true,
        priority: 10,
        counting_mode: EraCountingMode::ByCalendarYear,
    };
    let eras_cd = vec![era_cd];
    let cfg_cd = CalendarCultureConfig {
        planet_id: "planet",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: &[30, 31],
        harmonics: &[],
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &h_ok,
        eras: &eras_cd,
    };
    let coord_cd = DateCoordinate {
        era_index: 0,
        year: 5,
        month: 0,
        day: 10,
        unit_values: vec![0, 0],
    };
    assert_eq!(validate_date_coordinate(&coord_cd, &cfg_cd), Ok(()));

    assert_eq!(CalendarMutationMode::default(), CalendarMutationMode::LensPreserveAbsoluteTime);
    assert_eq!(CalendarMutationMode::FixPreserveNominalDates, CalendarMutationMode::FixPreserveNominalDates.clone());
    assert!(format!("{:?}", ConversionError::InvalidSourceDate).contains("InvalidSourceDate"));
    assert!(format!("{:?}", CalendarConfigValidationError::EmptyMonths).contains("EmptyMonths"));

    let ldt = LocalDateTime {
        calendar_id: "cal".into(),
        timezone_offset_ticks: 0,
        date: coord_cd,
    };
    assert_eq!(ldt, ldt.clone());
    assert!(format!("{:?}", ldt).contains("LocalDateTime"));

    // 10. ERAS: validate_era with end_year and compare_dates is_gt == false
    let era_valid_bounded = CoreEra {
        name: "Bounded".into(),
        start_year: 1000,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(2000),
        end_month: Some(12),
        end_day: Some(31),
        is_count_down: false,
        priority: 5,
        counting_mode: EraCountingMode::ByCalendarYear,
    };
    assert_eq!(validate_era(&era_valid_bounded, true), Ok(()));
    assert_eq!(EraValidationError::EndBeforeStart, EraValidationError::EndBeforeStart.clone());
    assert!(format!("{:?}", EraValidationError::InvalidDay).contains("InvalidDay"));

    // 11. INTERVALS: check_incremental_bilocation with same location (severity == None)
    let mod_entry = SceneIntervalEntry {
        scene_id: "s1",
        character_id: "hero",
        location_id: "locA",
        interval: TimeInterval { start: 10, end: 20 },
        precision: PrecisionLevel::ExactTick,
    };
    let same_loc_entry = SceneIntervalEntry {
        scene_id: "s2",
        character_id: "hero",
        location_id: "locA",
        interval: TimeInterval { start: 15, end: 25 },
        precision: PrecisionLevel::ExactTick,
    };
    let anom = check_incremental_bilocation(&mod_entry, &[same_loc_entry]);
    assert!(anom.is_empty());

    assert_eq!(IntervalValidationError::InvertedInterval, IntervalValidationError::InvertedInterval.clone());
    assert_eq!(AnomalySeverity::None, AnomalySeverity::None.clone());
    assert!(format!("{:?}", AnomalySeverity::Suspect).contains("Suspect"));
}

#[test]
fn test_coverage_100_percent_absolute_final_sweep() {
    use worldwiki_calendar_core::*;

    // 1. Year finder CorrectionExceeded lines 54 and 62
    assert_eq!(
        try_year_from_days_o1(i64::MIN, 1, &[], 0),
        Err(YearFinderError::CorrectionExceeded)
    );
    assert_eq!(
        try_year_from_days_o1(i64::MAX, 1, &[], 0),
        Err(YearFinderError::CorrectionExceeded)
    );

    // 2. Scalar.rs unwrap_or_else with ticks_per_day != 0
    let mom = t_abs_to_local_moment(i64::MAX, "planet", 1, i64::MIN);
    assert_eq!(mom.planet_id, "planet");

    // 3. Leap.rs validate_harmonics_step error propagation via ?
    let bad_harmonics = [LeapHarmonic {
        multiplier_a: 1,
        shift_b: 0,
        divisor_c: 0,
        weight: 1,
    }];
    assert_eq!(
        validate_harmonics_step(&bad_harmonics),
        Err(LeapValidationError::NonPositiveDivisor)
    );

    // 4. Leap.rs days_up_to_month_with_prefix fallthrough when target_month >= limit
    let prefix = [0, 30, 60, 90];
    let h = [LeapHarmonic {
        multiplier_a: 1,
        shift_b: 0,
        divisor_c: 4,
        weight: 1,
    }];
    let d_prefix = days_up_to_month_with_prefix(
        2000,
        2,
        &prefix,
        &LeapTarget::InMonth { target_month: 10 },
        1,
        &h,
    );
    assert_eq!(d_prefix, 60);

    // 5. Drift.rs RationalDrift PartialEq ne/eq, Debug, Clone
    let rd1 = RationalDrift { numerator_days: 10, denominator_years: 100 };
    let rd2 = RationalDrift { numerator_days: 20, denominator_years: 100 };
    assert!(rd1 == rd1);
    assert!(rd1 != rd2);
    assert!(format!("{:?}", rd1).contains("10"));
    assert_eq!(rd1.clone(), rd1);

    // 6. Dial.rs empty name in validate_dial_hierarchy and negative subdivisions
    let empty_name_hierarchy = DialHierarchy {
        units: vec![
            DialUnit { name: "".into(), subdivisions: 10 },
            DialUnit { name: "u2".into(), subdivisions: 5 },
        ],
    };
    assert!(validate_dial_hierarchy(&empty_name_hierarchy).is_ok());

    let neg_sub_hierarchy = DialHierarchy {
        units: vec![
            DialUnit { name: "u1".into(), subdivisions: -5 },
        ],
    };
    assert_eq!(
        validate_dial_hierarchy(&neg_sub_hierarchy),
        Err(DialError::ZeroOrNegativeSubdivision)
    );
    assert_eq!(
        validate_dial_bijection(&neg_sub_hierarchy, 100),
        Err(DialError::ZeroOrNegativeSubdivision)
    );

    // 7. Dial.rs all DialError variants Clone, Debug, Eq, PartialEq
    let de1 = DialError::ZeroOrNegativeSubdivision;
    let de2 = DialError::CapacityOverflow;
    let de3 = DialError::DuplicateUnitName("test_unit".into());
    let de4 = DialError::TicksNotDivisibleByCapacity {
        ticks_per_day: 100,
        dial_capacity: 30,
    };
    assert_eq!(de1.clone(), de1);
    assert_eq!(de2.clone(), de2);
    assert_eq!(de3.clone(), de3);
    assert_eq!(de4.clone(), de4);
    assert!(de1 != de2);
    assert!(de2 != de3);
    assert!(de3 != de4);
    assert!(de4 != de1);
    assert!(format!("{:?}", de1).contains("ZeroOrNegativeSubdivision"));
    assert!(format!("{:?}", de2).contains("CapacityOverflow"));
    assert!(format!("{:?}", de3).contains("DuplicateUnitName"));
    assert!(format!("{:?}", de4).contains("TicksNotDivisibleByCapacity"));

    // dial_capacity and total_dial_subdivisions with sub <= 0
    assert_eq!(dial_capacity(&[-10, 0, 5, 2]), 10);
    let mixed_sub_hierarchy = DialHierarchy {
        units: vec![
            DialUnit { name: "u1".into(), subdivisions: -10 },
            DialUnit { name: "u2".into(), subdivisions: 0 },
            DialUnit { name: "u3".into(), subdivisions: 4 },
        ],
    };
    assert_eq!(total_dial_subdivisions(&mixed_sub_hierarchy), 4);

    // 8. Drift.rs edge cases
    let rd_zero_den = RationalDrift { numerator_days: 10, denominator_years: 0 };
    assert_eq!(rd_zero_den.to_milli_days_per_century(), 0);
    assert_eq!(rd_zero_den.to_f64(), 0.0);
    let rd_diff_den = RationalDrift { numerator_days: 10, denominator_years: 50 };
    assert!(rd1 != rd_diff_den);

    assert_eq!(gcd(0, 0), 1);
    assert_eq!(lcm(0, 5), 1);
    assert_eq!(lcm(5, 0), 1);

    let h_non_positive = [
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: -5, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 0, weight: 1 },
    ];
    assert_eq!(harmonics_lcm(&h_non_positive), 1);
    let rd_neg_h = drift_per_century_rational(365, &h_non_positive, 365, 1);
    assert_eq!(rd_neg_h.numerator_days, 0);
    assert_eq!(drift_per_century(365, &h_non_positive, 365, 0), 0.0);
    assert!((drift_per_century_f64(365, &h_non_positive, 365.0) - (-20.0)).abs() < 1e-6);
    let h_zero_c = [LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 0, weight: 1 }];
    assert_eq!(drift_per_century_f64(365, &h_zero_c, 365.0), 0.0);

    // 9. Scalar.rs ScalarError clone, debug, eq, ne, try_from overflow
    let se1 = ScalarError::Overflow;
    let se2 = ScalarError::DivisionByZero;
    assert_eq!(se1.clone(), se1);
    assert_eq!(se2.clone(), se2);
    assert!(se1 != se2);
    assert!(format!("{:?}", se1).contains("Overflow"));
    assert!(format!("{:?}", se2).contains("DivisionByZero"));

    assert!(!validate_t_abs_bound(i64::MIN));
    assert!(!validate_t_abs_bound(i64::MAX));
    assert_eq!(normalize_day_start_offset(50, 0), 0);
    assert_eq!(normalize_day_start_offset(50, -10), 0);
    assert_eq!(revert_day_start_offset(100, 20, 1000), 80);

    assert_eq!(
        try_t_abs_to_local_moment(100, "p", 0, 0),
        Err(ScalarError::DivisionByZero)
    );
    assert_eq!(
        try_t_abs_to_local_moment(i64::MAX, "p", 1, i64::MIN),
        Err(ScalarError::Overflow)
    );

    let huge_moment = LocalMoment {
        planet_id: "p".into(),
        world_day: i64::MAX,
        day_tick: i64::MAX,
    };
    assert_eq!(
        try_local_moment_to_t_abs(&huge_moment, 1000, 0),
        Err(ScalarError::Overflow)
    );
    assert_eq!(local_moment_to_t_abs(&huge_moment, 1000, 0), i64::MAX);

    let fast_mom = t_abs_to_fast_moment(100, PlanetKey(1), 0, 0);
    assert_eq!(fast_mom.world_day, 100);

    // 10. Sync.rs calculate_linked_anchor_world_day with empty eras (fallback unwrap_or)
    let empty_eras_cfg = CalendarCultureConfig {
        planet_id: "p_local",
        ticks_per_day: 1000,
        day_start_offset: 0,
        base_year_days: 100,
        regular_months: &[50, 50],
        harmonics: &[],
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &DialHierarchy { units: vec![] },
        eras: &[],
    };
    let master_cfg = CalendarCultureConfig {
        planet_id: "p_master",
        ticks_per_day: 1000,
        day_start_offset: 0,
        base_year_days: 100,
        regular_months: &[50, 50],
        harmonics: &[],
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &DialHierarchy { units: vec![] },
        eras: &[],
    };
    let date_coord = DateCoordinate {
        era_index: 0,
        year: 1,
        month: 0,
        day: 1,
        unit_values: vec![],
    };
    let anchor = calculate_linked_anchor_world_day(
        &date_coord,
        &master_cfg,
        &date_coord,
        &empty_eras_cfg,
    );
    assert_eq!(anchor, 0);

    let invalid_date_coord = DateCoordinate {
        era_index: 0,
        year: 1,
        month: 99,
        day: 1,
        unit_values: vec![],
    };
    assert_eq!(
        try_calculate_linked_anchor_world_day(&invalid_date_coord, &master_cfg, &date_coord, &empty_eras_cfg),
        Err(ConversionError::InvalidSourceDate)
    );
    assert_eq!(
        try_calculate_linked_anchor_world_day(&date_coord, &master_cfg, &invalid_date_coord, &empty_eras_cfg),
        Err(ConversionError::InvalidTargetDate)
    );
}
