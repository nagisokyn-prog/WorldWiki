use crate::dst::{get_timezone_effective_offset, is_dst_active_fixed, DstFixedTransitionWindow};
use crate::types::{DstPolicy, PlanetTimezone};
use alloc::string::String;

#[kani::proof]
fn proof_dst_none_is_invariant() {
    let standard_offset: i32 = kani::any();
    kani::assume(standard_offset >= -720 && standard_offset <= 720);

    let tz = PlanetTimezone {
        id: String::new(),
        name: String::new(),
        code: String::new(),
        standard_offset_minutes: standard_offset,
        dst_policy: DstPolicy::None,
    };

    let m: usize = kani::any();
    kani::assume(m >= 1 && m <= 12);
    let d: i64 = kani::any();
    kani::assume(d >= 1 && d <= 31);
    let min: i32 = kani::any();
    kani::assume(min >= 0 && min < 1440);

    let eff = get_timezone_effective_offset(&tz, m, d, min);
    assert_eq!(eff, standard_offset);
}

#[kani::proof]
fn proof_dst_fixed_bounded() {
    let m: usize = kani::any();
    kani::assume(m >= 1 && m <= 12);
    let d: i64 = kani::any();
    kani::assume(d >= 1 && d <= 31);
    let min: i32 = kani::any();
    kani::assume(min >= 0 && min < 1440);

    // Весна 3/25, Осень 10/25, переход в 120 минут
    let window = DstFixedTransitionWindow {
        spring_month: 3,
        spring_day: 25,
        fall_month: 10,
        fall_day: 25,
        transition_minute: 120,
    };
    let is_active = is_dst_active_fixed(&window, m, d, min);

    if m < 3 || m > 10 {
        assert!(!is_active);
    } else if m > 3 && m < 10 {
        assert!(is_active);
    }
}

