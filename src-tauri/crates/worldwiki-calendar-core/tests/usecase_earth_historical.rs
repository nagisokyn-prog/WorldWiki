use worldwiki_calendar_core::age::calculate_age;
use worldwiki_calendar_core::dial::{day_tick_to_units, units_to_day_tick};
use worldwiki_calendar_core::eras::{era_year_number, find_active_era};
use worldwiki_calendar_core::leap::{days_in_month, days_in_year, drift_per_century_f64, is_leap_year};
use worldwiki_calendar_core::types::*;

#[test]
fn usecase_russian_calendar_julian_to_gregorian_shift() {
    // 1. Юлианский календарь (до 1918 года в России)
    let julian_harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
    ];
    // В Юлианском 1900 год был високосным (366 дней)
    assert_eq!(is_leap_year(1900, &julian_harmonics), 1);
    assert_eq!(days_in_year(1900, 365, 1, &julian_harmonics), 366);

    // Вековой дрейф юлианского календаря относительно тропического года (~0.78 сут/век)
    let julian_drift = drift_per_century_f64(365, &julian_harmonics, 365.2422);
    assert!(julian_drift > 0.70 && julian_drift < 0.85);

    // 2. Григорианский календарь (с 14 февраля 1918 года)
    let gregorian_harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];
    // В Григорианском 1900 год - невисокосный (365 дней), а 2000 - високосный
    assert_eq!(is_leap_year(1900, &gregorian_harmonics), 0);
    assert_eq!(is_leap_year(2000, &gregorian_harmonics), 1);

    let gregorian_drift = drift_per_century_f64(365, &gregorian_harmonics, 365.2422);
    assert!(gregorian_drift.abs() < 0.05, "Gregorian drift must be under 0.05 days/century");
}

#[test]
fn usecase_old_chinese_calendar_decimal_ke_and_traditional_age() {
    // Древний Китай: сутки делятся на 100 кэ (1 кэ = 14.4 мин = 864 сек)
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Ke".into(), subdivisions: 100 },
        ],
    };
    let ticks_per_day = 86400;

    // Полдень (середина суток) = 50 кэ = 43200 секунд
    let tick_noon = units_to_day_tick(&[50], &dial, ticks_per_day);
    assert_eq!(tick_noon, 43200);

    let restored_ke = day_tick_to_units(43200, &dial, ticks_per_day);
    assert_eq!(restored_ke, vec![50]);

    // Традиционный китайский расчет возраста (схож с традиционным корейским: 1 при рождении)
    let chinese_age_rule = AgeRule {
        age_at_birth: 1,
        step_on_new_year: true,
        year_only: false,
    };
    let birth = CalDate::new(2020, 1, 15);
    // В год рождения
    assert_eq!(calculate_age(birth, CalDate::new(2020, 6, 1), &chinese_age_rule, 30), 1);
    // В следующий Новый Год
    assert_eq!(calculate_age(birth, CalDate::new(2021, 2, 12), &chinese_age_rule, 30), 2);
}

#[test]
fn usecase_south_korean_three_age_reckoning_systems() {
    // В Южной Корее исторически сосуществовало 3 способа подсчета возраста:
    // Тестовый субъект: родился 31 декабря 2002 года
    let birth = CalDate::new(2002, 12, 31);
    let check_date = CalDate::new(2003, 1, 1); // Буквально на следующий день!

    // Способ 1: Корейский возраст (Korean Age / 세는наи) - возраст 1 при рождении, +1 в каждый Новый Год
    let korean_traditional = AgeRule {
        age_at_birth: 1,
        step_on_new_year: true,
        year_only: false,
    };
    // 31 декабря 2002: ребенку 1 день от роду, но возраст = 1 год
    assert_eq!(calculate_age(birth, CalDate::new(2002, 12, 31), &korean_traditional, 31), 1);
    // 1 января 2003: ребенку 2 дня от роду, но корейский возраст = 2 года!
    assert_eq!(calculate_age(birth, check_date, &korean_traditional, 31), 2);

    // Способ 2: Счетный/призывной возраст (Year Age / 연наи) - возраст 0 при рождении, +1 в каждый Новый Год (для военной службы и закона о молодежи)
    let year_age = AgeRule {
        age_at_birth: 0,
        step_on_new_year: true,
        year_only: true,
    };
    assert_eq!(calculate_age(birth, CalDate::new(2002, 12, 31), &year_age, 31), 0);
    assert_eq!(calculate_age(birth, check_date, &year_age, 31), 1);

    // Способ 3: Международный возраст (International Age / 만наи) - возраст 0 при рождении, +1 в день рождения (утвержден законом с июня 2023)
    let international_age = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };
    assert_eq!(calculate_age(birth, check_date, &international_age, 31), 0);
    // Исполняется 1 год строго 31 декабря 2003 года
    assert_eq!(calculate_age(birth, CalDate::new(2003, 12, 30), &international_age, 31), 0);
    assert_eq!(calculate_age(birth, CalDate::new(2003, 12, 31), &international_age, 31), 1);
}

#[test]
fn usecase_ancient_egyptian_civil_calendar_and_sothic_cycle() {
    // Древнеегипетский гражданский календарь: строго 365 суток, без високосных дней.
    // 12 месяцев по 30 суток = 360, плюс 5 добавочных дней (эпагомены)
    let egyptian_months = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 5];
    let no_harmonics: Vec<LeapHarmonic> = vec![];

    for y in 1..=100 {
        assert_eq!(is_leap_year(y, &no_harmonics), 0);
        assert_eq!(days_in_year(y, 365, 0, &no_harmonics), 365);
    }

    // Сотический цикл: за счет отсутствия високосных дней календарь отстает на 1 день каждые 4 года
    // 365.25 - 365.0 = 0.25 дня в год = 25 дней за 100 лет (полный цикл 1460 лет)
    let egyptian_drift = drift_per_century_f64(365, &no_harmonics, 365.25);
    assert!((egyptian_drift - (-25.0)).abs() < 1e-6);

    // 12 месяцев по 30 дней, 13-й эпагоменальный месяц = 5 дней
    let leap_target = LeapTarget::InExtraDays;
    for m in 0..12 {
        assert_eq!(days_in_month(1, m, &egyptian_months, &leap_target, 0, &no_harmonics), 30);
    }
    assert_eq!(days_in_month(1, 12, &egyptian_months, &leap_target, 0, &no_harmonics), 5);
}

#[test]
fn usecase_japanese_pre1873_nengo_eras() {
    // Японская система императорских эр (нэнго):
    let eras = vec![
        CoreEra {
            name: "Bunkyu".into(),
            start_year: 1861,
            start_month: Some(2),
            start_day: Some(19),
            end_year: Some(1864),
            end_month: Some(2),
            end_day: Some(20),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
        CoreEra {
            name: "Genji".into(),
            start_year: 1864,
            start_month: Some(2),
            start_day: Some(20),
            end_year: Some(1865),
            end_month: Some(4),
            end_day: Some(7),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
        CoreEra {
            name: "Keio".into(),
            start_year: 1865,
            start_month: Some(4),
            start_day: Some(7),
            end_year: Some(1868),
            end_month: Some(10),
            end_day: Some(23),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
        CoreEra {
            name: "Meiji".into(),
            start_year: 1868,
            start_month: Some(10),
            start_day: Some(23),
            end_year: Some(1912),
            end_month: Some(7),
            end_day: Some(30),
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
    ];

    // В 1868 году: до 23 октября действовала эра Кэйо (Keio 4)
    let era_before_oct = find_active_era(&eras, 1868, 5, 1).unwrap();
    assert_eq!(era_before_oct.name, "Keio");
    assert_eq!(era_year_number(era_before_oct, 1868, 5, 1, 31), 4);

    // С 23 октября 1868 наступила эра Мэйдзи 1 (Meiji 1)
    let era_meiji = find_active_era(&eras, 1868, 10, 24).unwrap();
    assert_eq!(era_meiji.name, "Meiji");
    assert_eq!(era_year_number(era_meiji, 1868, 10, 24, 31), 1);

    // 1870 год = Meiji 3
    let era_meiji3 = find_active_era(&eras, 1870, 1, 1).unwrap();
    assert_eq!(era_year_number(era_meiji3, 1870, 1, 1, 31), 3);
}

#[test]
fn usecase_french_republican_decimal_calendar_1793_1795() {
    // Французский республиканский календарь:
    // 1. Десятичное время: 10 часов в сутках, 100 минут в часе, 100 секунд в минуте (всего 100 000 секунд)
    let decimal_dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Heure".into(), subdivisions: 10 },
            DialUnit { name: "Minute".into(), subdivisions: 100 },
            DialUnit { name: "Seconde".into(), subdivisions: 100 },
        ],
    };
    let ticks_per_day = 100_000;

    // Полдень: 5 часов 0 минут 0 секунд
    let tick_noon = units_to_day_tick(&[5, 0, 0], &decimal_dial, ticks_per_day);
    assert_eq!(tick_noon, 50_000);
    assert_eq!(day_tick_to_units(50_000, &decimal_dial, ticks_per_day), vec![5, 0, 0]);

    // 2. Месяцы: 12 месяцев по 30 дней + 5 санкюлотид (дополнительных дней)
    let months = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 5];
    let harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
    ];
    let leap_target = LeapTarget::InMonth { target_month: 12 }; // 13-й месяц санкюлотид расширяется до 6 дней в високосный год

    // 3-й год республики (невисокосный): 5 санкюлотид
    assert_eq!(days_in_month(3, 12, &months, &leap_target, 1, &harmonics), 5);
    // 4-й год республики (високосный): 6 санкюлотид
    assert_eq!(days_in_month(4, 12, &months, &leap_target, 1, &harmonics), 6);
    assert_eq!(days_in_year(4, 365, 1, &harmonics), 366);
}
