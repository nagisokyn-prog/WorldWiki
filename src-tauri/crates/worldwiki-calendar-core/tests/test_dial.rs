use worldwiki_calendar_core::dial::*;
use worldwiki_calendar_core::types::{DialHierarchy, DialUnit};

#[test]
fn test_total_dial_subdivisions_standard() {
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
            DialUnit { name: "Second".into(), subdivisions: 60 },
        ],
    };
    assert_eq!(total_dial_subdivisions(&dial), 86400);
}

#[test]
fn test_total_dial_subdivisions_empty() {
    let empty = DialHierarchy { units: vec![] };
    assert_eq!(total_dial_subdivisions(&empty), 0);
}

#[test]
fn test_dial_quantization_standard_earth() {
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
            DialUnit { name: "Minute".into(), subdivisions: 60 },
        ],
    };
    let ticks_per_day = 86400;

    // 12:30 -> ровно середина суток + 30 минут = 45000 секунд
    let tick = units_to_day_tick(&[12, 30], &dial, ticks_per_day);
    assert_eq!(tick, 45000);

    let units = day_tick_to_units(tick, &dial, ticks_per_day);
    assert_eq!(units, vec![12, 30]);

    // 00:00 -> 0
    let tick_zero = units_to_day_tick(&[0, 0], &dial, ticks_per_day);
    assert_eq!(tick_zero, 0);
    assert_eq!(day_tick_to_units(0, &dial, ticks_per_day), vec![0, 0]);

    // 23:59 -> 86340
    let tick_end = units_to_day_tick(&[23, 59], &dial, ticks_per_day);
    assert_eq!(tick_end, 86340);
    assert_eq!(day_tick_to_units(tick_end, &dial, ticks_per_day), vec![23, 59]);
}

#[test]
fn test_dial_quantization_fantasy_watches_bells() {
    // Фэнтези: 10 страж по 50 колоколов (всего 500 делений)
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Watch".into(), subdivisions: 10 },
            DialUnit { name: "Bell".into(), subdivisions: 50 },
        ],
    };
    let ticks_per_day = 100000;

    for w in 0..10 {
        for b in 0..50 {
            let tick = units_to_day_tick(&[w, b], &dial, ticks_per_day);
            assert!(tick >= 0 && tick < ticks_per_day);
            let restored = day_tick_to_units(tick, &dial, ticks_per_day);
            assert_eq!(restored, vec![w, b], "Failed for watch {w}, bell {b}");
        }
    }
}

#[test]
fn test_dial_edge_cases() {
    let dial = DialHierarchy {
        units: vec![
            DialUnit { name: "Hour".into(), subdivisions: 24 },
        ],
    };
    // Пустые показания
    assert_eq!(units_to_day_tick(&[], &dial, 86400), 0);

    // Тик за пределами суток
    let units_neg = day_tick_to_units(-100, &dial, 86400);
    assert_eq!(units_neg, vec![0]);

    let units_overflow = day_tick_to_units(100000, &dial, 86400);
    assert_eq!(units_overflow, vec![23]);
}
