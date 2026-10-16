use crate::dial::{day_tick_to_units, total_dial_subdivisions, units_to_day_tick};
use crate::types::{DialHierarchy, DialUnit};
use alloc::string::String;
use alloc::vec;

#[kani::proof]
#[kani::unwind(5)]
fn proof_dial_reversible_no_loss() {
    let u1_sub: i64 = kani::any();
    let u2_sub: i64 = kani::any();
    kani::assume(u1_sub >= 1 && u1_sub <= 4);
    kani::assume(u2_sub >= 1 && u2_sub <= 6);

    let hierarchy = DialHierarchy {
        units: vec![
            DialUnit {
                name: String::new(),
                subdivisions: u1_sub,
            },
            DialUnit {
                name: String::new(),
                subdivisions: u2_sub,
            },
        ],
    };

    let total_d = total_dial_subdivisions(&hierarchy);
    assert_eq!(total_d, u1_sub * u2_sub);

    let ticks_per_day = total_d;

    let v1: i64 = kani::any();
    let v2: i64 = kani::any();
    kani::assume(v1 >= 0 && v1 < u1_sub);
    kani::assume(v2 >= 0 && v2 < u2_sub);

    let unit_values = [v1, v2];
    let tick = units_to_day_tick(&unit_values, &hierarchy, ticks_per_day);
    let restored = day_tick_to_units(tick, &hierarchy, ticks_per_day);

    assert!(restored.len() == 2 && restored[0] == v1 && restored[1] == v2);
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_dial_monotonic() {
    let hierarchy = DialHierarchy {
        units: vec![
            DialUnit {
                name: String::new(),
                subdivisions: 4,
            },
            DialUnit {
                name: String::new(),
                subdivisions: 6,
            },
        ],
    };
    let ticks_per_day = 24;

    let tick1: i64 = kani::any();
    let tick2: i64 = kani::any();
    kani::assume(tick1 >= 0 && tick1 <= tick2 && tick2 < ticks_per_day);

    let u1 = day_tick_to_units(tick1, &hierarchy, ticks_per_day);
    let u2 = day_tick_to_units(tick2, &hierarchy, ticks_per_day);

    let linear1 = u1.first().copied().unwrap_or(0) * 6 + u1.get(1).copied().unwrap_or(0);
    let linear2 = u2.first().copied().unwrap_or(0) * 6 + u2.get(1).copied().unwrap_or(0);

    assert!(linear1 <= linear2);
}

#[kani::proof]
fn proof_dial_subdivisions_nonzero() {
    use crate::dial::validate_dial_hierarchy;

    let sub: i64 = kani::any();
    let hierarchy = DialHierarchy {
        units: vec![DialUnit {
            name: String::new(),
            subdivisions: sub,
        }],
    };
    if sub <= 0 {
        assert!(validate_dial_hierarchy(&hierarchy).is_err());
    } else {
        assert!(validate_dial_hierarchy(&hierarchy).is_ok());
    }
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_dial_ticks_bounded() {
    use crate::dial::checked_total_dial_subdivisions;

    let s1: i64 = kani::any();
    let s2: i64 = kani::any();
    kani::assume(s1 > 0 && s1 <= 1_000_000);
    kani::assume(s2 > 0 && s2 <= 1_000_000);

    let hierarchy = DialHierarchy {
        units: vec![
            DialUnit {
                name: String::new(),
                subdivisions: s1,
            },
            DialUnit {
                name: String::new(),
                subdivisions: s2,
            },
        ],
    };

    let res = checked_total_dial_subdivisions(&hierarchy);
    let Ok(total) = res else {
        return;
    };
    assert!(total > 0);
    assert_eq!(total, s1 * s2);
}


