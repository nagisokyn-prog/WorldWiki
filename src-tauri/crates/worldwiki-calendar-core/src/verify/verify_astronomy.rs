use crate::astronomy::{
    calculate_daylight_and_sun_events, moon_phase_exact, moon_phase_rational, solar_noon_tick,
    PlanetSunContext,
};

#[kani::proof]
fn proof_solar_noon_bounded_for_all_longitudes() {
    let ticks_per_day: i64 = kani::any();
    kani::assume(ticks_per_day >= 1000 && ticks_per_day <= 100_000);

    let longitude_mdeg: i64 = kani::any();
    kani::assume(longitude_mdeg >= -180_000 && longitude_mdeg <= 180_000);

    let retrograde: bool = kani::any();

    let noon = solar_noon_tick(ticks_per_day, longitude_mdeg, retrograde);
    assert!(noon >= 0);
    assert!(noon < ticks_per_day);

    // Долгота 0 дает ровно середину суток
    let noon_prime = solar_noon_tick(ticks_per_day, 0, retrograde);
    assert_eq!(noon_prime, ticks_per_day / 2);
}

#[kani::proof]
fn proof_daylight_ticks_bounded() {
    let ticks_per_day: i64 = kani::any();
    kani::assume(ticks_per_day >= 1000 && ticks_per_day <= 100_000);

    let summer_bp: i64 = kani::any();
    kani::assume(summer_bp >= 0 && summer_bp <= 10_000);

    let winter_bp: i64 = kani::any();
    kani::assume(winter_bp >= 0 && winter_bp <= 10_000);

    let world_day: i64 = kani::any();
    kani::assume(world_day >= -10_000 && world_day <= 10_000);

    let ctx = PlanetSunContext {
        solstice_world_day: 0,
        ticks_per_day,
        tropical_year_num: 365,
        tropical_year_den: 1,
        summer_day_fraction_bp: summer_bp,
        winter_day_fraction_bp: winter_bp,
        is_north_hemisphere: true,
        longitude_mdeg: 0,
        retrograde: false,
    };

    let events = calculate_daylight_and_sun_events(world_day, &ctx);
    assert!(events.daylight_ticks >= 0);
    assert!(events.daylight_ticks <= ticks_per_day);
    assert!(events.sunrise_tick >= 0 && events.sunrise_tick < ticks_per_day);
    assert!(events.sunset_tick >= 0 && events.sunset_tick < ticks_per_day);
}

#[kani::proof]
fn proof_moon_phase_rational_bounded() {
    let t_abs: i64 = kani::any();
    kani::assume(t_abs >= -1_000_000 && t_abs <= 1_000_000);

    let ticks_per_day: i64 = 86_400;
    let period_num: i64 = 295;
    let period_den: i64 = 10;
    let initial_bp: i64 = kani::any();
    kani::assume(initial_bp >= 0 && initial_bp < 10_000);

    let (phase_bp, _) = moon_phase_rational(t_abs, ticks_per_day, period_num, period_den, initial_bp);
    assert!(phase_bp >= 0);
    assert!(phase_bp < 10_000);
}

#[kani::proof]
fn proof_moon_phase_exact_consistency() {
    let ticks_per_day = 86_400;
    let period_num = 30;
    let period_den = 1;

    let (phase_1, _) = moon_phase_exact(0, ticks_per_day, period_num, period_den, 1, 2);
    assert_eq!(phase_1, 5000); // 1/2 цикла = 5000 bp (полнолуние)

    let (phase_zero, _) = moon_phase_exact(0, ticks_per_day, period_num, period_den, 0, 1);
    assert_eq!(phase_zero, 0); // 0 = новолуние
}

#[kani::proof]
fn proof_moon_period_positive() {
    let p_num: i64 = kani::any();
    let p_den: i64 = kani::any();

    let moon = crate::astronomy::MoonConfig {
        name: alloc::string::String::new(),
        period_days_num: p_num,
        period_days_den: p_den,
        initial_phase_bp: 0,
    };

    let is_valid = moon.validate().is_ok();
    assert_eq!(is_valid, p_num > 0 && p_den > 0);
}

#[kani::proof]
fn proof_solar_noon_longitude_bounded() {
    let lon_deg: i64 = kani::any();
    kani::assume(lon_deg >= -180 && lon_deg <= 180);

    let lon_mdeg = lon_deg * 1000;
    let noon = solar_noon_tick(86_400, lon_mdeg, false);
    assert!(noon >= 0 && noon < 86_400);
}

