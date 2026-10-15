use worldwiki_calendar_core::astronomy::solar_noon_tick;
use worldwiki_calendar_core::conversion::{date_to_t_abs, t_abs_to_date, CalendarCultureConfig};
use worldwiki_calendar_core::dial::units_to_day_tick;
use worldwiki_calendar_core::scalar::{local_moment_to_t_abs, t_abs_to_local_moment};
use worldwiki_calendar_core::types::*;

#[test]
fn usecase_coruscant_galactic_standard_calendar_bby_aby() {
    // Корусант — эталон галактического времени:
    // 368 суток в году, 24 часа по 60 минут (86 400 секунд в сутках)
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
            DialUnit { name: "Second".into(), subdivisions: 60 },
        ],
    };
    let months = [35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 18]; // Упрощенное разбиение 368 дней
    let harmonics: Vec<LeapHarmonic> = vec![];

    let bby_aby_eras = vec![
        CoreEra {
            name: "BBY".into(), // Before Battle of Yavin
            start_year: 0,
            start_month: Some(1),
            start_day: Some(1),
            end_year: Some(0),
            end_month: Some(12),
            end_day: Some(368),
            is_count_down: true,
            counting_mode: EraCountingMode::ByCalendarYear,
        },
        CoreEra {
            name: "ABY".into(), // After Battle of Yavin
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

    let coruscant_config = CalendarCultureConfig {
        planet_id: "coruscant",
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 368,
        regular_months: &months,
        harmonics: &harmonics,
        leap_target: LeapTarget::InExtraDays,
        leap_day_offset: 0,
        calendar_origin_day: 0,
        dial: &dial,
        eras: &bby_aby_eras,
    };

    // Битва при Явине (1 ABY): день 1, 15:30:00
    let yavin_battle = DateCoordinate {
        era_index: 1, // ABY
        year: 1,
        month: 0,
        day: 1,
        unit_values: vec![15, 30, 0],
    };

    let t_abs_yavin = date_to_t_abs(&yavin_battle, &coruscant_config);
    // 15 часов * 3600 + 30 минут * 60 = 55800 секунд от начала эпохи Явина
    assert_eq!(t_abs_yavin, 55800);

    let restored = t_abs_to_date(t_abs_yavin, &coruscant_config);
    assert_eq!(restored.era_index, 1);
    assert_eq!(restored.year, 1);
    assert_eq!(restored.unit_values, vec![15, 30, 0]);

    // Проверка 1 BBY (предшествующий год до Битвы при Явине)
    let pre_yavin = DateCoordinate {
        era_index: 0, // BBY
        year: 1,
        month: 0,
        day: 1,
        unit_values: vec![0, 0, 0],
    };
    let t_abs_pre = date_to_t_abs(&pre_yavin, &coruscant_config);
    // Ровно за 368 суток до Явина: -368 * 86400 = -31795200 секунд
    assert_eq!(t_abs_pre, -368 * 86400);

    let restored_pre = t_abs_to_date(t_abs_pre, &coruscant_config);
    assert_eq!(restored_pre.era_index, 0);
    assert_eq!(restored_pre.year, 1);
}

#[test]
fn usecase_tatooine_twin_suns_and_moisture_farming_shifts() {
    // Татуин:
    // Местные сутки = 34 часа (122 400 секунд)
    // Год = 304 местных суток
    let ticks_per_day = 122_400;

    // Циферблат влагодобытчиков: 3 смены (Утренняя прохлада, Зной двух солнц, Ночной сбор)
    let tatooine_dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Shift".into(), subdivisions: 3 }, // 3 смены в сутках
            DialUnit { name: "Hour".into(), subdivisions: 11 },  // ~11 часов в смене
        ],
    };

    // Проверка квантования смены (вторая смена = 1/3 суток = 40 800 тиков)
    let shift2_tick = units_to_day_tick(&[1, 0], &tatooine_dial, ticks_per_day);
    assert_eq!(shift2_tick, 40_800);

    // Астрономия Татуина: два солнца Tatoo I и Tatoo II
    // Tatoo I: полдень на нулевом меридиане строго в середине суток (тик 61 200)
    let noon_sun1 = solar_noon_tick(ticks_per_day, 0, false);
    assert_eq!(noon_sun1, 61_200);

    // Tatoo II: смещено по долготе на 30 градусов (30 000 миллиградусов)
    // 30 / 360 * 122400 = 10200 тиков смещения
    let noon_sun2 = solar_noon_tick(ticks_per_day, -30_000, false);
    assert_eq!(noon_sun2, 61_200 + 10_200); // 71400 тиков
    assert_eq!(noon_sun2 - noon_sun1, 10_200, "Twin suns angular separation preserved");
}

#[test]
fn usecase_cross_planetary_synchronization_coruscant_tatooine_lothal() {
    // Сквозная синхронизация трех планет через единый галактический скаляр t_abs:
    // Событие: Имперский указ издан на Корусанте в t_abs = 10_000_000 (секунд от эпохи Явина)
    let galactic_event_t_abs = 10_000_000i64;

    // 1. Корусант (сутки 86 400 сек)
    let coruscant_moment = t_abs_to_local_moment(galactic_event_t_abs, "coruscant", 86400, 0);
    assert_eq!(coruscant_moment.world_day, 115); // 10_000_000 / 86400 = 115 суток
    assert_eq!(coruscant_moment.day_tick, 64000); // 64000 секунд дня

    // 2. Татуин (сутки 122 400 сек, смещение рассвета 10 000 сек)
    let tatooine_moment = t_abs_to_local_moment(galactic_event_t_abs, "tatooine", 122400, 10000);
    // (10_000_000 - 10_000) / 122400 = 9_990_000 / 122400 = 81 день, остаток 75600
    assert_eq!(tatooine_moment.world_day, 81);
    assert_eq!(tatooine_moment.day_tick, 75600);

    // 3. Лотал (сутки 36 часов = 129 600 сек)
    let lothal_moment = t_abs_to_local_moment(galactic_event_t_abs, "lothal", 129600, 0);
    assert_eq!(lothal_moment.world_day, 77); // 10_000_000 / 129600 = 77
    assert_eq!(lothal_moment.day_tick, 20800);

    // Обратная верификация: все три наблюдателя восстанавливают СТРОГО один и тот же t_abs!
    let restored_from_coruscant = local_moment_to_t_abs(&coruscant_moment, 86400, 0);
    let restored_from_tatooine = local_moment_to_t_abs(&tatooine_moment, 122400, 10000);
    let restored_from_lothal = local_moment_to_t_abs(&lothal_moment, 129600, 0);

    assert_eq!(restored_from_coruscant, galactic_event_t_abs);
    assert_eq!(restored_from_tatooine, galactic_event_t_abs);
    assert_eq!(restored_from_lothal, galactic_event_t_abs);
}
