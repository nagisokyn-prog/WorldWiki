extern crate alloc;
use crate::scalar::euclidean_div_rem;

/// Фаза луны (8 классических секторов)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum MoonPhaseName {
    NewMoon,
    WaxingCrescent,
    FirstQuarter,
    WaxingGibbous,
    FullMoon,
    WaningGibbous,
    LastQuarter,
    WaningCrescent,
}

/// Вычисляет позицию истинного полудня (солнечного зенита) в тиках суток
/// с учетом прямого или ретроградного вращения планеты.
///
/// Долгота передается в миллиградусах: от -180_000 до +180_000 (360_000 миллиградусов = 360 градусов).
/// При прямом вращении (retrograde = false) солнце движется с востока на запад,
/// поэтому на восточных долготах (+lon) полдень наступает раньше.
/// При ретроградном вращении (retrograde = true) планета вращается в обратную сторону,
/// солнце восходит на западе, и знак смещения долготы инвертируется.
pub fn solar_noon_tick(
    ticks_per_day: i64,
    longitude_mdeg: i64,
    retrograde: bool,
) -> i64 {
    if ticks_per_day <= 0 {
        return 0;
    }
    let effective_mdeg = if retrograde {
        -longitude_mdeg
    } else {
        longitude_mdeg
    };

    // Базовый полдень на нулевом меридиане: середина суток
    let noon_base = ticks_per_day / 2;
    // Смещение за счет долготы: (effective_mdeg / 360_000) * ticks_per_day
    let offset = (effective_mdeg as i128 * ticks_per_day as i128) / 360_000;
    let raw_noon = noon_base as i128 - offset;
    let (_, noon_tick) = euclidean_div_rem(raw_noon as i64, ticks_per_day);
    noon_tick
}

/// Зенитное расстояние солнца в миллиградусах (от 0 до 180_000)
/// 0 mdeg = солнце строго в зените (истинный полдень)
/// 90_000 mdeg = солнце на горизонте (восход / закат)
/// 180_000 mdeg = солнце строго в надире (истинная полночь)
pub fn solar_zenith_distance_mdeg(
    day_tick: i64,
    ticks_per_day: i64,
    longitude_mdeg: i64,
    retrograde: bool,
) -> i64 {
    if ticks_per_day <= 0 {
        return 0;
    }
    let noon = solar_noon_tick(ticks_per_day, longitude_mdeg, retrograde);
    let diff = (day_tick - noon).abs();
    // Минимальное круговое расстояние по окружности суток
    let circular_diff = if diff > ticks_per_day / 2 {
        ticks_per_day - diff
    } else {
        diff
    };

    // Перевод тиков в миллиградусы: (circular_diff / (ticks_per_day / 2)) * 180_000
    let mdeg = (circular_diff as i128 * 180_000) / (ticks_per_day as i128 / 2).max(1);
    (mdeg as i64).min(180_000)
}

/// Доля освещенности (инсоляция) в базисных пунктах: от 0 (ночь) до 10_000 (зенит)
pub fn sunlight_basis_points(
    day_tick: i64,
    ticks_per_day: i64,
    longitude_mdeg: i64,
    retrograde: bool,
) -> i64 {
    let zenith_mdeg = solar_zenith_distance_mdeg(day_tick, ticks_per_day, longitude_mdeg, retrograde);
    if zenith_mdeg >= 90_000 {
        // Солнце за горизонтом
        0
    } else {
        // Линейная аппроксимация инсоляции над горизонтом
        // 90_000 mdeg -> 0 bp, 0 mdeg -> 10_000 bp
        let above_horizon = 90_000 - zenith_mdeg;
        (above_horizon as i128 * 10_000 / 90_000) as i64
    }
}

/// Рациональный расчет фазы луны без погрешности с плавающей запятой
///
/// Синодический период задается как rational: period_days_num / period_days_den.
/// Сдвиг начальной фазы: initial_phase_basis_points в диапазоне 0..10_000 (0 = новолуние, 5000 = полнолуние).
/// Возвращает текущую фазу в базисных пунктах [0, 10_000) и сектор фазы.
pub fn moon_phase_rational(
    t_abs: i64,
    ticks_per_day: i64,
    period_days_num: i64,
    period_days_den: i64,
    initial_phase_basis_points: i64,
) -> (i64, MoonPhaseName) {
    if ticks_per_day <= 0 || period_days_num <= 0 || period_days_den <= 0 {
        return (0, MoonPhaseName::NewMoon);
    }

    // Полный период в тиках выражается через дробь:
    // T_cycle = (period_days_num * ticks_per_day) / period_days_den
    let num_ticks = period_days_num as i128 * ticks_per_day as i128;
    let den_ticks = period_days_den as i128;

    // Фазовый сдвиг в масштабе числителя:
    // shift_ticks = (initial_phase_bp * num_ticks) / (10_000 * den_ticks)
    // Масштабируем t_abs к общему знаменателю den_ticks:
    // scaled_t = t_abs * den_ticks + (initial_phase_bp * num_ticks / 10_000)
    let phase_shift_scaled = (initial_phase_basis_points as i128 * num_ticks) / 10_000;
    let total_scaled = t_abs as i128 * den_ticks + phase_shift_scaled;

    // Остаток по модулю num_ticks (длины цикла):
    let rem = total_scaled.rem_euclid(num_ticks);

    // Доля цикла в базисных пунктах: (rem * 10_000) / num_ticks
    let current_bp = ((rem * 10_000) / num_ticks) as i64;

    let phase_name = match current_bp {
        bp if (0..625).contains(&bp) || (9375..10_000).contains(&bp) => MoonPhaseName::NewMoon,
        bp if (625..1875).contains(&bp) => MoonPhaseName::WaxingCrescent,
        bp if (1875..3125).contains(&bp) => MoonPhaseName::FirstQuarter,
        bp if (3125..4375).contains(&bp) => MoonPhaseName::WaxingGibbous,
        bp if (4375..5625).contains(&bp) => MoonPhaseName::FullMoon,
        bp if (5625..6875).contains(&bp) => MoonPhaseName::WaningGibbous,
        bp if (6875..8125).contains(&bp) => MoonPhaseName::LastQuarter,
        _ => MoonPhaseName::WaningCrescent,
    };

    (current_bp, phase_name)
}

/// Результат расчета астрономических событий солнца для конкретного дня
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct SunEvents {
    /// Продолжительность светового дня в тиках
    pub daylight_ticks: i64,
    /// Момент истинного полудня (зенита)
    pub noon_tick: i64,
    /// Момент восхода солнца в тиках суток
    pub sunrise_tick: i64,
    /// Момент захода солнца в тиках суток
    pub sunset_tick: i64,
}

/// Контекст астрономических параметров планеты и региона
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct PlanetSunContext {
    pub solstice_world_day: i64,
    pub ticks_per_day: i64,
    pub tropical_year_num: i64,
    pub tropical_year_den: i64,
    pub summer_day_fraction_bp: i64, // Базисные пункты: от 0 до 10_000
    pub winter_day_fraction_bp: i64, // Базисные пункты: от 0 до 10_000
    pub is_north_hemisphere: bool,
    pub longitude_mdeg: i64,
    pub retrograde: bool,
}

/// Вычисляет длину светового дня, зенит, восход и закат на основе параметров солнцестояния планеты
/// (Спецификация раздел 3.10)
pub fn calculate_daylight_and_sun_events(
    world_day: i64,
    ctx: &PlanetSunContext,
) -> SunEvents {
    if ctx.ticks_per_day <= 0 || ctx.tropical_year_num <= 0 || ctx.tropical_year_den <= 0 {
        return SunEvents {
            daylight_ticks: 0,
            noon_tick: 0,
            sunrise_tick: 0,
            sunset_tick: 0,
        };
    }

    // 1. Фаза года от базового зимнего солнцестояния
    let diff_days = world_day - ctx.solstice_world_day;
    let cycle_step = (diff_days as i128 * ctx.tropical_year_den as i128)
        .rem_euclid(ctx.tropical_year_num as i128);
    // Доля года в базисных пунктах от 0 до 10_000 (0 = зимнее солнцестояние, 5000 = летнее солнцестояние)
    let year_fraction_bp = ((cycle_step * 10_000) / ctx.tropical_year_num as i128) as i64;

    // 2. Косинусоидальная волна сезонных колебаний в диапазоне [-10_000, 10_000]
    // В точке 0 (зима): wave = -10_000
    // В точке 2500 (весеннее равноденствие): wave = 0
    // В точке 5000 (лето): wave = +10_000
    // В точке 7500 (осеннее равноденствие): wave = 0
    let wave = if year_fraction_bp < 5000 {
        // От -10_000 до +10_000: параболическая гладкая гармоника
        let x = year_fraction_bp - 2500; // от -2500 до +2500
        (x * 10_000) / 2500
    } else {
        // От +10_000 до -10_000
        let x = 7500 - year_fraction_bp; // от +2500 до -2500
        (x * 10_000) / 2500
    };

    let hemisphere_sign = if ctx.is_north_hemisphere { 1 } else { -1 };
    let signed_wave = wave * hemisphere_sign;

    // 3. Длина светового дня в базисных пунктах
    let mid_fraction = (ctx.summer_day_fraction_bp + ctx.winter_day_fraction_bp) / 2;
    let amp_fraction = (ctx.summer_day_fraction_bp - ctx.winter_day_fraction_bp) / 2;
    let day_fraction_bp = (mid_fraction + (signed_wave * amp_fraction) / 10_000).clamp(0, 10_000);

    let daylight_ticks = (day_fraction_bp as i128 * ctx.ticks_per_day as i128 / 10_000) as i64;

    // 4. Зенит, восход и закат
    let noon = solar_noon_tick(ctx.ticks_per_day, ctx.longitude_mdeg, ctx.retrograde);
    let half_day = daylight_ticks / 2;

    let (_, sunrise) = euclidean_div_rem(noon - half_day, ctx.ticks_per_day);
    let (_, sunset) = euclidean_div_rem(noon + half_day, ctx.ticks_per_day);

    SunEvents {
        daylight_ticks,
        noon_tick: noon,
        sunrise_tick: sunrise,
        sunset_tick: sunset,
    }
}

