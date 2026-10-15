use worldwiki_calendar_core::astronomy::*;

#[test]
fn test_solar_noon_tick_prograde() {
    let ticks_per_day = 86400;

    // Нулевой меридиан: полдень в середине суток
    assert_eq!(solar_noon_tick(ticks_per_day, 0, false), 43200);

    // Восток 90 градусов (90 000 миллиградусов) -> солнце раньше на 1/4 суток
    assert_eq!(solar_noon_tick(ticks_per_day, 90_000, false), 21600);

    // Запад 90 градусов (-90 000 миллиградусов) -> солнце позже на 1/4 суток
    assert_eq!(solar_noon_tick(ticks_per_day, -90_000, false), 64800);

    // 180 градусов
    assert_eq!(solar_noon_tick(ticks_per_day, 180_000, false), 0);
}

#[test]
fn test_solar_noon_tick_retrograde() {
    let ticks_per_day = 86400;

    // При ретроградном вращении (Венера): солнце движется с запада на восток
    // Восток 90 градусов -> солнце ПОЗЖЕ на 1/4 суток
    assert_eq!(solar_noon_tick(ticks_per_day, 90_000, true), 64800);

    // Запад 90 градусов -> солнце РАНЬШЕ на 1/4 суток
    assert_eq!(solar_noon_tick(ticks_per_day, -90_000, true), 21600);
}

#[test]
fn test_solar_zenith_and_sunlight_bounds() {
    let ticks_per_day = 86400;

    // В полдень (тик 43200, меридиан 0): зенитное расстояние 0, инсоляция 10 000
    let zenith_noon = solar_zenith_distance_mdeg(43200, ticks_per_day, 0, false);
    assert_eq!(zenith_noon, 0);
    assert_eq!(sunlight_basis_points(43200, ticks_per_day, 0, false), 10000);

    // В полночь (тик 0, меридиан 0): зенитное расстояние 180 000, инсоляция 0
    let zenith_midnight = solar_zenith_distance_mdeg(0, ticks_per_day, 0, false);
    assert_eq!(zenith_midnight, 180_000);
    assert_eq!(sunlight_basis_points(0, ticks_per_day, 0, false), 0);

    // На рассвете и закате (тик 21600 и 64800, 90 градусов): инсоляция строго 0
    let zenith_horizon = solar_zenith_distance_mdeg(21600, ticks_per_day, 0, false);
    assert_eq!(zenith_horizon, 90_000);
    assert_eq!(sunlight_basis_points(21600, ticks_per_day, 0, false), 0);
}

#[test]
fn test_moon_phase_rational_earth_lunar_month() {
    let ticks_per_day = 86400;
    // Синодический месяц Земли ~ 29.530588 суток = 29530588 / 1000000
    let num = 29530588;
    let den = 1000000;

    // Начало (новолуние): фаза 0 б.п.
    let (bp_new, name_new) = moon_phase_rational(0, ticks_per_day, num, den, 0);
    assert_eq!(bp_new, 0);
    assert_eq!(name_new, MoonPhaseName::NewMoon);

    // Четверть месяца (~7.38 суток = 637860 секунд): первая четверть
    let t_quarter = (7 * 86400) + (9 * 3600);
    let (bp_q, name_q) = moon_phase_rational(t_quarter, ticks_per_day, num, den, 0);
    assert!(bp_q > 2000 && bp_q < 3000);
    assert_eq!(name_q, MoonPhaseName::FirstQuarter);

    // Половина месяца (~14.76 суток): полнолуние (5000 б.п.)
    let t_full = (14 * 86400) + (18 * 3600);
    let (bp_full, name_full) = moon_phase_rational(t_full, ticks_per_day, num, den, 0);
    assert!(bp_full > 4500 && bp_full < 5500);
    assert_eq!(name_full, MoonPhaseName::FullMoon);
}
