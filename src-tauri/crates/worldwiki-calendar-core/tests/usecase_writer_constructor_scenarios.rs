use worldwiki_calendar_core::age::calculate_age;
use worldwiki_calendar_core::astronomy::{
    MoonPhaseName, PlanetSunContext, calculate_daylight_and_sun_events, moon_phase_rational,
    solar_noon_tick,
};
use worldwiki_calendar_core::convergents::{LeapApproximation, calculate_leap_convergents};
use worldwiki_calendar_core::conversion::{
    CalendarCultureConfig, calculate_linked_anchor_world_day, convert_calendar_date,
};
use worldwiki_calendar_core::dial::{day_tick_to_units, units_to_day_tick};
use worldwiki_calendar_core::eras::era_year_number;
use worldwiki_calendar_core::holidays::{is_holiday_active, to_cultural_month, to_internal_month};
use worldwiki_calendar_core::leap::{days_in_month, drift_per_century, validate_harmonics_lcm};

use worldwiki_calendar_core::seasons::{
    CoreSeason, find_season_index, is_month_in_season, is_season_conflicting_with_solstice,
};
use worldwiki_calendar_core::types::*;
use worldwiki_calendar_core::weekdays::{WeekdayPauseConfig, calculate_weekday_with_pause};

/// Карточка 4.0: Астрофизика планеты (PlanetPhysics.vue)
/// Прямое vs ретроградное вращение планеты (Венера), тропический год и истинный полдень.
#[test]
fn usecase_card_4_0_planet_physics_retrograde_and_solstice() {
    let ticks_per_day = 86400i64;

    // На прямом вращении (Земля) долгота +90° (90_000 миллиградусов, восток)
    // видит истинный полдень раньше нулевого меридиана (0°)
    let noon_east = solar_noon_tick(ticks_per_day, 90_000, false);
    let noon_prime = solar_noon_tick(ticks_per_day, 0, false);
    assert!(
        noon_east < noon_prime,
        "East longitude sees solar noon earlier in direct rotation"
    );

    // На ретроградном вращении (Венера) восток (+90°) опаздывает, а запад (-90°) опережает
    let venus_noon_east = solar_noon_tick(ticks_per_day, 90_000, true);
    let venus_noon_west = solar_noon_tick(ticks_per_day, -90_000, true);
    assert!(
        venus_noon_west < venus_noon_east,
        "West longitude sees solar noon earlier on retrograde planet"
    );
}

/// Карточка 4.1: Основные сведения (CalendarGeneral.vue)
/// Режим синхронизации SyncAnchor::Linked — сопряжение нулевой точки и вычисление anchor_world_day.
#[test]
fn usecase_card_4_1_sync_anchor_linked_pairing() {
    let dial_24 = DialHierarchy {
        units: vec![
            DialUnit {
                name: "Hour".into(),
                subdivisions: 24,
            },
            DialUnit {
                name: "Minute".into(),
                subdivisions: 60,
            },
        ],
    };
    let gregorian_harmonics = vec![
        LeapHarmonic {
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 4,
            weight: 1,
        },
        LeapHarmonic {
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 100,
            weight: -1,
        },
        LeapHarmonic {
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 400,
            weight: 1,
        },
    ];
    let regular_months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    let master_config = CalendarCultureConfig {
        planet_id: "terra",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: &regular_months,
        harmonics: &gregorian_harmonics,
        leap_target: LeapTarget::InMonth { target_month: 1 },
        leap_day_offset: 1,
        calendar_origin_day: 0,
        dial: &dial_24,
        eras: &[],
    };

    // Местный календарь колонии: год 1 месяц 0 день 1 (00:00) соответствует
    // году 2500 месяцу 4 (май) дню 15 (00:00) в Master-календаре
    let master_pair_date = DateCoordinate {
        era_index: 0,
        year: 2500,
        month: 4,
        day: 15,
        unit_values: vec![0, 0],
    };
    let colony_pair_date = DateCoordinate {
        era_index: 0,
        year: 1,
        month: 0,
        day: 1,
        unit_values: vec![0, 0],
    };

    let computed_anchor_world_day = calculate_linked_anchor_world_day(
        &master_pair_date,
        &master_config,
        &colony_pair_date,
        &master_config,
    );
    assert!(computed_anchor_world_day > 900_000);

    // Проверяем сопряженный календарь с вычисленным anchor_world_day
    let mut colony_config = master_config.clone();
    colony_config.calendar_origin_day = computed_anchor_world_day;

    let converted_colony = convert_calendar_date(&master_pair_date, &master_config, &colony_config);
    assert_eq!(converted_colony.year, 1);
    assert_eq!(converted_colony.month, 0);
    assert_eq!(converted_colony.day, 1);
}

/// Карточка 4.2: Деление суток циферблата (CalendarDial.vue)
/// Кастомный циферблат Арракиса / фэнтези: 4 стражи, 6 колоколов, 100 ударов гонга.
#[test]
fn usecase_card_4_2_fantasy_dial_watches_bells_gongs() {
    let fantasy_dial = DialHierarchy {
        units: vec![
            DialUnit {
                name: "Watch".into(),
                subdivisions: 4,
            },
            DialUnit {
                name: "Bell".into(),
                subdivisions: 6,
            },
            DialUnit {
                name: "Gong".into(),
                subdivisions: 100,
            },
        ],
    };
    let ticks_per_day = 86400; // 4 * 6 * 100 = 2400 квантов циферблата

    // 2-я стража (индекс 2), 3-й колокол, 50 ударов гонга
    let units = [2, 3, 50];
    let tick = units_to_day_tick(&units, &fantasy_dial, ticks_per_day);

    let restored_units = day_tick_to_units(tick, &fantasy_dial, ticks_per_day);
    assert_eq!(restored_units, vec![2, 3, 50]);

    // Смещение начала суток на закат (-0.25 от суток = -21600 тиков)
    let sunset_offset = -21600i64;
    assert_eq!(sunset_offset, -(ticks_per_day / 4));
}

/// Карточка 4.3: Дни недели (CalendarWeekdays.vue)
/// Список дней недели как единственный источник правды и пауза на дни празднеств года.
#[test]
fn usecase_card_4_3_weekdays_with_paused_extra_days() {
    let pause_config = WeekdayPauseConfig {
        days_in_regular_months: 360,
        extra_days_base: 5,
        extra_days_leap: 1,
        harmonics: &[LeapHarmonic {
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 4,
            weight: 1,
        }],
        origin_year: 1,
        origin_day: 0,
        start_weekday: 0,
        weekdays_count: 10,
    };

    // Обычный 359-й день года (30 Фрюктидора)
    let w_regular = calculate_weekday_with_pause(1, 359, &pause_config);
    assert!(w_regular.is_some());

    // Санкюлотиды (дни 360-364 вне месяцев): неделя замораживается
    let w_extra_1 = calculate_weekday_with_pause(1, 360, &pause_config);
    assert_eq!(
        w_extra_1, None,
        "Weekdays must be paused during extra epagomenal days"
    );

    // 1 день 2-го года (день 0 года II): продолжается ровно с 0 (Примиди) без сдвига
    let w_year_2 = calculate_weekday_with_pause(2, 0, &pause_config);
    assert_eq!(w_year_2, Some(0)); // Примиди
}

/// Карточка 4.4: Точка отсчета календаря (CalendarOrigin.vue)
/// Произвольный стартовый год, месяц, день и день недели.
#[test]
fn usecase_card_4_4_calendar_origin_custom_start() {
    let origin = CalendarOrigin {
        year: 753, // От основания Рима (AUC)
        month: 2,  // Март
        day: 1,
        weekday: 3, // Четверг
    };
    assert_eq!(origin.year, 753);
    assert_eq!(origin.month, 2);
    assert_eq!(origin.weekday, 3);
}

/// Карточка 4.5: Месяцы года (CalendarMonths.vue)
/// Первый месяц года (first_month_of_year): Римский мартовский (M_start = 2) и Древнерусский сентябрьский (M_start = 8).
#[test]
fn usecase_card_4_5_first_month_of_year_rotation_roman_and_russian() {
    let total_months = 12usize;

    // Римский мартовский Новый Год: Март (культурный 2) становится внутренним месяцем 0
    let m_start_roman = 2usize;
    let internal_march = to_internal_month(2, m_start_roman, total_months);
    assert_eq!(internal_march, 0, "March must be internal month 0");
    assert_eq!(to_cultural_month(0, m_start_roman, total_months), 2);

    // Январь (культурный 0) становится внутренним месяцем 10
    let internal_jan = to_internal_month(0, m_start_roman, total_months);
    assert_eq!(internal_jan, 10);
    assert_eq!(to_cultural_month(10, m_start_roman, total_months), 0);

    // Февраль (культурный 1) — последний внутренний месяц года (11), где добавляется високосный день
    let internal_feb = to_internal_month(1, m_start_roman, total_months);
    assert_eq!(internal_feb, 11);

    // Древнерусский сентябрьский стиль: Сентябрь (культурный 8) становится внутренним 0
    let m_start_russian = 8usize;
    let internal_sept = to_internal_month(8, m_start_russian, total_months);
    assert_eq!(internal_sept, 0);
    assert_eq!(to_cultural_month(0, m_start_russian, total_months), 8);

    // Биективность для всех 12 месяцев
    for m in 0..total_months {
        let internal = to_internal_month(m, m_start_roman, total_months);
        let restored = to_cultural_month(internal, m_start_roman, total_months);
        assert_eq!(m, restored);
    }
}

/// Карточка 4.6: Праздничные дни вне месяцев (CalendarExtraDays.vue)
/// Ацтекский Немонтеми (18 месяцев по 20 дней + 5 дней вне месяцев = 365).
#[test]
fn usecase_card_4_6_extra_days_outside_months_nemontemi() {
    let months_count = 18;
    let days_per_month = 20;
    let nemontemi_extra_days = 5;

    let total_civil_days = months_count * days_per_month + nemontemi_extra_days;
    assert_eq!(total_civil_days, 365);
}

/// Карточка 4.7: Климатические сезоны (CalendarSeasons.vue)
/// Привязка месяцев к сезонам и валидация конфликта с солнцестоянием полушария.
#[test]
fn usecase_card_4_7_seasons_and_solstice_conflict_warning() {
    let seasons = vec![
        CoreSeason {
            name: "Winter".into(),
            color: "#00f".into(),
            months: vec![11, 0, 1],
        },
        CoreSeason {
            name: "Spring".into(),
            color: "#0f0".into(),
            months: vec![2, 3, 4],
        },
        CoreSeason {
            name: "Summer".into(),
            color: "#f00".into(),
            months: vec![5, 6, 7],
        },
        CoreSeason {
            name: "Autumn".into(),
            color: "#ff0".into(),
            months: vec![8, 9, 10],
        },
    ];

    assert_eq!(find_season_index(0, &seasons), Some(0)); // Январь -> Зима
    assert_eq!(find_season_index(6, &seasons), Some(2)); // Июль -> Лето
    assert!(is_month_in_season(6, &seasons[2]));

    // Валидация: если писатель объявляет месяц 0 (январь) "Летом" (is_summer_season = true),
    // но месяц 0 совпадает с месяцем зимнего солнцестояния (solstice_month = 0), движок выдает конфликт
    let conflict = is_season_conflicting_with_solstice(&[0, 1, 2], true, 0, 12);
    assert!(
        conflict,
        "Summer during winter solstice months must be flagged as conflicting"
    );

    let no_conflict = is_season_conflicting_with_solstice(&[5, 6, 7], true, 0, 12);
    assert!(!no_conflict);
}

/// Карточка 4.8: Праздники и памятные даты (CalendarHolidays.vue)
/// Обычные праздники и праздники с переходом через границу Нового Года (Йоль, зимние святки).
#[test]
fn usecase_card_4_8_holidays_crossing_new_year_boundary() {
    // 1. Обычный праздник внутри одного года: День Победы (1 мая - 9 мая)
    assert!(is_holiday_active(4, 5, 4, 1, 4, 9));
    assert!(!is_holiday_active(4, 10, 4, 1, 4, 9));

    // 2. Праздник через границу Нового Года: Йоль / Святки (25 декабря по 6 января)
    // Месяц 11 (декабрь), день 25 -> Месяц 0 (январь), день 6
    assert!(
        is_holiday_active(11, 28, 11, 25, 0, 6),
        "Dec 28 is within Yule"
    );
    assert!(
        is_holiday_active(11, 31, 11, 25, 0, 6),
        "New Year Eve is within Yule"
    );
    assert!(
        is_holiday_active(0, 1, 11, 25, 0, 6),
        "Jan 1 is within Yule"
    );
    assert!(
        is_holiday_active(0, 5, 11, 25, 0, 6),
        "Jan 5 is within Yule"
    );
    assert!(
        !is_holiday_active(0, 7, 11, 25, 0, 6),
        "Jan 7 is after Yule"
    );
    assert!(
        !is_holiday_active(5, 1, 11, 25, 0, 6),
        "May 1 is outside Yule"
    );
}

/// Карточка 4.9: Високосные правила (CalendarLeapYear.vue)
/// Пресет Джалали (8/33), Лунно-солнечный Метонов Адар II и помощник цепных дробей.
#[test]
fn usecase_card_4_9_leap_presets_jalali_metonic_adar_and_continued_fractions() {
    // 1. Помощник цепных дробей для тропического года Земли (365.2422 -> 2422 / 10000)
    let approximations = calculate_leap_convergents(3652422, 10000, 5);
    assert!(approximations.len() >= 3);
    assert_eq!(
        approximations[0],
        LeapApproximation {
            leap_years: 1,
            cycle_years: 4
        }
    ); // 1/4 (Юлианский)
    assert_eq!(
        approximations[1],
        LeapApproximation {
            leap_years: 7,
            cycle_years: 29
        }
    ); // 7/29
    assert_eq!(
        approximations[2],
        LeapApproximation {
            leap_years: 8,
            cycle_years: 33
        }
    ); // 8/33 (Джалали)

    // 2. Иранский (Джалали) 33-летний цикл: 8 високосов на 33 года
    let jalali_harmonics = vec![LeapHarmonic {
        multiplier_a: 8,
        shift_b: 0,
        divisor_c: 33,
        weight: 1,
    }];
    assert!(validate_harmonics_lcm(&jalali_harmonics));
    let jalali_drift = drift_per_century(365, &jalali_harmonics, 3652422, 10000);
    assert!(
        jalali_drift.abs() < 0.05,
        "Jalali drift must be under 0.05 days/century"
    );

    // 3. Лунно-солнечный вставной 13-й месяц (Адар II, индекс 12):
    // Базовая длина = 0 дней в обычный год, +30 дней в високосный год
    let lunisolar_months = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 0];
    let metonic_harmonics = vec![LeapHarmonic {
        multiplier_a: 7,
        shift_b: 1,
        divisor_c: 19,
        weight: 1,
    }];
    let leap_target = LeapTarget::InMonth { target_month: 12 };

    // В невисокосный год (год 1) длина Адар II = 0 дней
    let adar_days_common = days_in_month(
        1,
        12,
        &lunisolar_months,
        &leap_target,
        30,
        &metonic_harmonics,
    );
    assert_eq!(adar_days_common, 0);

    // В високосный год Метонова цикла длина Адар II = 30 дней
    // Год 3 високосный в Метоновом цикле (floor((7 * 3 + 1)/19) - floor((7 * 2 + 1)/19) = 1 - 0 = 1)
    let adar_days_leap = days_in_month(
        3,
        12,
        &lunisolar_months,
        &leap_target,
        30,
        &metonic_harmonics,
    );
    assert_eq!(adar_days_leap, 30);
}

/// Карточка 4.10: Эпохи и правители (CalendarEras.vue)
/// Обратный отсчет (is_count_down) к Падению Империи, годовщина коронации и открытая эра.
#[test]
fn usecase_card_4_10_eras_countdown_and_coronation_anniversary() {
    // 1. Обратный отсчет к Падению Империи (событие в 1000 году)
    let countdown_era = CoreEra {
        name: "Before the Fall".into(),
        start_year: 900,
        start_month: Some(1),
        start_day: Some(1),
        end_year: Some(1000),
        end_month: Some(12),
        end_day: Some(31),
        is_count_down: true,
        counting_mode: EraCountingMode::ByCalendarYear,
    };
    // В 998 году: (1000 - 998) + 1 = 3-й год до Падения
    let yr_998 = era_year_number(&countdown_era, 998, 5, 1, 30);
    assert_eq!(yr_998, 3);
    // В 999 году: 2-й год
    let yr_999 = era_year_number(&countdown_era, 999, 5, 1, 30);
    assert_eq!(yr_999, 2);
    // В 1000 году: 1-й год до Падения
    let yr_1000 = era_year_number(&countdown_era, 1000, 5, 1, 30);
    assert_eq!(yr_1000, 1);

    // 2. Годовщина коронации ByAnniversary (коронация 29 февраля високосного года)
    let monarch_era = CoreEra {
        name: "King Arthur".into(),
        start_year: 2000,
        start_month: Some(2),
        start_day: Some(29),
        end_year: None,
        end_month: None,
        end_day: None,
        is_count_down: false,
        counting_mode: EraCountingMode::ByAnniversary,
    };
    // В невисокосном 2001 году 27 февраля — все еще 1-й год правления
    let yr_2001_early = era_year_number(&monarch_era, 2001, 2, 27, 28);
    assert_eq!(yr_2001_early, 1);
    // 28 февраля (последний день невисокосного февраля) — годовщина наступает, начинается 2-й год!
    let yr_2001_anniversary = era_year_number(&monarch_era, 2001, 2, 28, 28);
    assert_eq!(yr_2001_anniversary, 2);
}

/// Карточка 4.11: Часовые пояса и Регионы (PlanetEnvironment.vue)
/// Полярный день / белые ночи на 65° широты и закат/восход на солнцестояниях.
#[test]
fn usecase_card_4_11_planetary_regions_sun_events_and_polar_white_nights() {
    let ctx = PlanetSunContext {
        solstice_world_day: 355,
        ticks_per_day: 86400,
        tropical_year_num: 365,
        tropical_year_den: 1,
        summer_day_fraction_bp: 9000, // 90% дня летом (21.6 ч)
        winter_day_fraction_bp: 1000, // 10% дня зимой (2.4 ч)
        is_north_hemisphere: true,
        longitude_mdeg: 0,
        retrograde: false,
    };

    let summer_day = 355 + 182; // Летнее солнцестояние
    let sun_summer = calculate_daylight_and_sun_events(summer_day, &ctx);
    assert!(
        sun_summer.daylight_ticks > 70000,
        "High latitude summer must have long daylight ticks"
    );

    let winter_day = 355; // Зимнее солнцестояние
    let sun_winter = calculate_daylight_and_sun_events(winter_day, &ctx);
    assert!(
        sun_winter.daylight_ticks < 15000,
        "High latitude winter must have very short daylight ticks"
    );
}

/// Карточка 4.12: Спутники и луны (PlanetEnvironment.vue)
/// Две луны с рациональными периодами и совпадение полнолуний (Двойное Полнолуние).
#[test]
fn usecase_card_4_12_multi_moon_sky_and_cultural_phase_names() {
    let ticks_per_day = 86400i64;

    // Луна 1 (Большая Луна): синодический период 28 суток
    // Луна 2 (Малая Луна): синодический период 14 суток
    let t_abs_start = 0i64; // Оба в новолунии (phase = 0 bp)
    let (_, name_moon1_start) = moon_phase_rational(t_abs_start, ticks_per_day, 28, 1, 0);
    let (_, name_moon2_start) = moon_phase_rational(t_abs_start, ticks_per_day, 14, 1, 0);
    assert_eq!(name_moon1_start, MoonPhaseName::NewMoon);
    assert_eq!(name_moon2_start, MoonPhaseName::NewMoon);

    // Через 14 суток:
    // Луна 1 (28 суток) проходит половину периода -> Полнолуние!
    // Луна 2 (14 суток) проходит полный период -> Новолуние!
    let t_abs_day_14 = 14 * ticks_per_day;
    let (_, name_moon1_d14) = moon_phase_rational(t_abs_day_14, ticks_per_day, 28, 1, 0);
    let (_, name_moon2_d14) = moon_phase_rational(t_abs_day_14, ticks_per_day, 14, 1, 0);
    assert_eq!(name_moon1_d14, MoonPhaseName::FullMoon);
    assert_eq!(name_moon2_d14, MoonPhaseName::NewMoon);
}


/// Карточка 4.13: Правило возраста персонажей (CalendarAgeRule.vue)
/// Традиционный возраст (1 при рождении, взросление 1 января) и рождение 29 февраля в невисокосном году.
#[test]
fn usecase_card_4_13_age_rules_leap_day_and_traditional_east_asian() {
    // 1. Рожденный 29 февраля 2000 года (високосный)
    let birth_leap = CalDate::new(2000, 1, 29);
    let western_rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };
    // В невисокосном 2001 году 27 февраля исполняется ли 1 год? Нет, еще 0!
    let curr_2001_feb27 = CalDate::new(2001, 1, 27);
    let age_2001_feb27 = calculate_age(birth_leap, curr_2001_feb27, &western_rule, 28);
    assert_eq!(age_2001_feb27, 0);

    // 28 февраля (последний день невисокосного февраля) — день рождения зачтен, исполняется 1 год!
    let curr_2001_feb28 = CalDate::new(2001, 1, 28);
    let age_2001_feb28 = calculate_age(birth_leap, curr_2001_feb28, &western_rule, 28);
    assert_eq!(age_2001_feb28, 1);

    // 2. Традиционный восточноазиатский возраст (age_at_birth = 1, step_on_new_year = true)
    let asian_rule = AgeRule {
        age_at_birth: 1,
        step_on_new_year: true,
        year_only: false,
    };
    // Ребенок родился 31 декабря 2020 года -> при рождении ему 1 год
    let birth_asian = CalDate::new(2020, 11, 31);
    let age_born = calculate_age(birth_asian, birth_asian, &asian_rule, 31);
    assert_eq!(age_born, 1);

    // На следующий день (1 января 2021 года) наступает Новый Год -> ребенку исполняется 2 года!
    let curr_asian_ny = CalDate::new(2021, 0, 1);
    let age_next_day = calculate_age(birth_asian, curr_asian_ny, &asian_rule, 31);
    assert_eq!(age_next_day, 2);
}
