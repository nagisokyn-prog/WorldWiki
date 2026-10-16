use worldwiki_calendar_core::astronomy::moon_phase_rational;
use worldwiki_calendar_core::scalar::{fast_moment_to_t_abs, t_abs_to_fast_moment};
use worldwiki_calendar_core::types::{FastLocalMoment, LeapHarmonic, PlanetKey};
use worldwiki_calendar_core::year_finder::year_from_days_o1;

#[test]
fn test_perf_year_from_days_100k_iterations() {
    let harmonics = [
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];

    let mut day = 0i64;
    for _ in 0..100_000 {
        let (y, rem) = year_from_days_o1(day, 365, &harmonics, 1);
        assert!(y >= 0);
        assert!(rem < 366);
        day += 365;
    }
}

#[test]
fn test_perf_moon_phase_rational_100k_iterations() {
    let ticks_per_day = 86_400i64;
    let mut t_abs = 0i64;
    for _ in 0..100_000 {
        let (bp, _) = moon_phase_rational(t_abs, ticks_per_day, 29530589, 1000000, 0);
        assert!(bp < 10_000);
        t_abs += ticks_per_day;
    }
}

#[test]
fn test_perf_fast_local_moment_zero_alloc() {
    let key = PlanetKey(42);
    let moment = FastLocalMoment {
        planet_key: key,
        world_day: 1000,
        day_tick: 500,
    };

    let t_abs = fast_moment_to_t_abs(moment, 86400, 0);
    let restored = t_abs_to_fast_moment(t_abs, key, 86400, 0);
    assert_eq!(moment, restored);
}
