use worldwiki_calendar_core::age::calculate_age;
use worldwiki_calendar_core::conversion::{convert_calendar_date, date_to_t_abs, CalendarCultureConfig};
use worldwiki_calendar_core::dial::{day_tick_to_units, units_to_day_tick};
use worldwiki_calendar_core::eras::{era_year_number, find_active_era};
use worldwiki_calendar_core::leap::{days_in_month, days_in_year, days_up_to_year, drift_per_century_f64, is_leap_year};
use worldwiki_calendar_core::types::*;
use worldwiki_calendar_core::weekdays::{calculate_weekday_with_pause, WeekdayPauseConfig};
use worldwiki_calendar_core::year_finder::year_from_days_o1;

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

#[test]
fn usecase_time_traveler_french_republican_to_russian_empire_julian() {
    // СЮЖЕТ: 18 Брюмера VIII года Республики (9 ноября 1799 года), переворот Наполеона Бонапарта.
    // Наполеон в Париже в 4:50:00 десятичного времени (4.50 из 10 часов) отправляет секретную депешу.
    // Депеша моментально попадает в Санкт-Петербург императору Павлу I.

    // 1. Конфигурация Франции (Республиканский календарь)
    // 10 часов по 100 минут по 100 секунд = 100 000 единиц циферблата
    let french_dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Heure".into(), subdivisions: 10 },
            DialUnit { name: "Minute".into(), subdivisions: 100 },
            DialUnit { name: "Seconde".into(), subdivisions: 100 },
        ],
    };
    let french_months = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 5];
    // Франсиада: високосными были III, VII, XI годы (shift_b = 1)
    let french_harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 1, divisor_c: 4, weight: 1 },
    ];
    let french_eras = vec![
        CoreEra {
            name: "Republique".into(),
            start_year: 1, // 1792 год н.э.
            start_month: Some(1),
            start_day: Some(1),
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
    ];

    // Точка отсчета Французского календаря: 1 Вандемьера I года = 22 сентября 1792 г. н.э.
    // В сутках Земли 86 400 секунд
    let earth_ticks_per_day = 86_400;

    let french_config = CalendarCultureConfig {
        planet_id: "earth",
        ticks_per_day: earth_ticks_per_day,
        day_start_offset: 0, // Полночь в Париже
        base_year_days: 365,
        regular_months: &french_months,
        harmonics: &french_harmonics,
        leap_target: LeapTarget::InMonth { target_month: 12 },
        leap_day_offset: 1,
        calendar_origin_day: 654_416, // Точное смещение эры республики относительно 1 г. н.э.
        dial: &french_dial,
        eras: &french_eras,
    };

    // 18 Брюмера VIII года: месяц Брюмер (индекс 1), день 18, время 4:50:00
    let napoleon_coup_date = DateCoordinate {
        era_index: 0,
        year: 8,
        month: 1, // Брюмер (2-й месяц)
        day: 18,
        unit_values: vec![4, 50, 0], // 4 часа 50 минут десятичных (45% суток)
    };

    let _t_abs = date_to_t_abs(&napoleon_coup_date, &french_config);

    // 2. Конфигурация Российской Империи (Юлианский календарь, старый стиль)
    // 24 часа по 60 минут по 60 секунд (86 400 секунд)
    let russian_dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
            DialUnit { name: "Second".into(), subdivisions: 60 },
        ],
    };
    let russian_months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let russian_harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
    ];
    let russian_eras = vec![
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

    // Санкт-Петербург находится на Пулковском меридиане (~30° в.д., +2 часа = +7200 сек от Парижа)
    let spb_timezone_offset = 7200;

    let russian_config = CalendarCultureConfig {
        planet_id: "earth",
        ticks_per_day: earth_ticks_per_day,
        day_start_offset: -spb_timezone_offset, // Смещение часового пояса СПб
        base_year_days: 365,
        regular_months: &russian_months,
        harmonics: &russian_harmonics,
        leap_target: LeapTarget::InMonth { target_month: 1 }, // Февраль
        leap_day_offset: 1,
        calendar_origin_day: 0, // 1 января 1 года н.э.
        dial: &russian_dial,
        eras: &russian_eras,
    };

    // Перегоняем дату Наполеона в Санкт-Петербург
    let pavel_date = convert_calendar_date(&napoleon_coup_date, &french_config, &russian_config);

    // 1. Год в России: 1799 год
    assert_eq!(pavel_date.year, 1799);
    // 2. Месяц: Октябрь (индекс 9)
    assert_eq!(pavel_date.month, 9);
    // 3. День: ровно 29 октября (старый стиль, на 11 дней раньше 9 ноября григорианского!)
    assert_eq!(pavel_date.day, 29);

    // 4. Время: 4.50 десятичных часов = 0.45 суток = 10 часов 48 минут утра в Париже.
    // В Санкт-Петербурге (+2 часа): 12 часов 48 минут дня!
    assert_eq!(pavel_date.unit_values[0], 12); // Часы
    assert_eq!(pavel_date.unit_values[1], 48); // Минуты

    // Обратная конвертация: из Санкт-Петербурга обратно в Париж Наполеону
    let restored_french = convert_calendar_date(&pavel_date, &russian_config, &french_config);
    assert_eq!(restored_french.year, 8);
    assert_eq!(restored_french.month, 1);
    assert_eq!(restored_french.day, 18);
    assert_eq!(restored_french.unit_values[0], 4);
    assert_eq!(restored_french.unit_values[1], 50);
}

#[test]
fn usecase_paused_weekday_cycles_and_intercalary_days() {
    // СЮЖЕТ: Французский республиканский календарь и пауза недели.
    // 12 месяцев по 3 декады (30 дней) = 360 дней.
    // Дни декады: 0: Примиди, 1: Дуоди, ..., 9: Декади (10 дней в неделе).
    // Дни 361..365 — это 5 Санкюлотид (празднества добродетели, таланта, труда, мнений, наград).
    // Чекбокс: "Приостанавливать недельный счет на дни празднеств года".
    let french_harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
    ];

    let pause_config = WeekdayPauseConfig {
        days_in_regular_months: 360,
        extra_days_base: 5,
        extra_days_leap: 1,
        harmonics: &french_harmonics,
        origin_year: 1,
        origin_day: 0,
        start_weekday: 0,
        weekdays_count: 10,
    };

    // День 359 (30 Фрюктидора, последний день 12-го месяца)
    // Должен быть Декади (индекс 9)
    let weekday_last_regular = calculate_weekday_with_pause(1, 359, &pause_config);
    assert_eq!(weekday_last_regular, Some(9)); // Декади!

    // Дни 360..364 — Санкюлотиды (дни вне месяцев и вне недели)
    for holiday_day in 360..365 {
        let weekday_holiday = calculate_weekday_with_pause(1, holiday_day, &pause_config);
        assert_eq!(weekday_holiday, None, "Санкюлотиды обязаны быть вне недели!");
    }

    // Новый Год (2-й год республики, день 0 — 1 Вандемьера):
    // Неделя ВОЗОБНОВЛЯЕТСЯ ровно с Примиди (индекс 0), без сдвига на 5 дней!
    let weekday_new_year = calculate_weekday_with_pause(2, 0, &pause_config);
    assert_eq!(weekday_new_year, Some(0), "1 Вандемьера обязано начаться строго с Примиди (0)!");
}

#[test]
fn usecase_herschel_rule_4000_year_anomaly() {
    // СЮЖЕТ: Правило Джона Гершеля / астрономическая отмена високоса в 4000 году.
    // Григорианский календарь дает ошибку в 1 день за ~3300 лет.
    // Чтобы устранить ее, правило Гершеля отменяет високосность каждого года, кратного 4000.
    let herschel_harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4000, weight: -1 }, // Исключение Гершеля!
    ];

    // 1. Год 3996: високосный (делится на 4)
    assert_eq!(is_leap_year(3996, &herschel_harmonics), 1);
    assert_eq!(days_in_year(3996, 365, 1, &herschel_harmonics), 366);

    // 2. ГОД 4000: НЕВИСОКОСНЫЙ! (хотя делится на 400, но отменен правилом 4000)
    assert_eq!(is_leap_year(4000, &herschel_harmonics), 0);
    assert_eq!(days_in_year(4000, 365, 1, &herschel_harmonics), 365);

    // 3. Год 4004: снова високосный (делится на 4)
    assert_eq!(is_leap_year(4004, &herschel_harmonics), 1);
    assert_eq!(days_in_year(4004, 365, 1, &herschel_harmonics), 366);

    // 4. Проверка векового дрейфа относительно точного тропического года (365.24219 суток)
    let drift_gregorian = drift_per_century_f64(
        365,
        &[
            LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
            LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
            LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
        ],
        365.24219,
    );
    let drift_herschel = drift_per_century_f64(365, &herschel_harmonics, 365.24219);

    // Правило Гершеля на порядок точнее обычного григорианского!
    assert!(drift_herschel.abs() < drift_gregorian.abs());

    // 5. Проверка алгоритма O(1) Year Finder на стыке 4000 года
    let days_before_4000 = days_up_to_year(4000, 365, 1, &herschel_harmonics);
    let (found_year_3999, _) = year_from_days_o1(days_before_4000 - 1, 365, &herschel_harmonics, 1);
    let (found_year_4000, day_in_4000) = year_from_days_o1(days_before_4000, 365, &herschel_harmonics, 1);
    let (found_year_4001, _) = year_from_days_o1(days_before_4000 + 365, 365, &herschel_harmonics, 1);

    assert_eq!(found_year_3999, 3999);
    assert_eq!(found_year_4000, 4000);
    assert_eq!(day_in_4000, 0);
    assert_eq!(found_year_4001, 4001);
}

