extern crate alloc;
use crate::scalar::euclidean_div_rem;
pub use crate::moons::*;

/// Вычисляет позицию истинного полудня (солнечного зенита) в тиках суток
/// с учетом прямого или ретроградного вращения планеты.
///
/// Долгота передается в миллиградусах: от -180_000 до +180_000 (360_000 миллиградусов = 360 градусов).
/// - При прямом вращении (retrograde = false) солнце движется с востока на запад,
///   поэтому на восточных долготах (+lon) полдень наступает раньше.
/// - При ретроградном вращении (retrograde = true) планета вращается в обратную сторону,
///   солнце восходит на западе, и знак смещения долготы инвертируется (п. 9.4).
/// - На нулевом меридиане (lon = 0) полдень наступает ровно в середине суток (ticks_per_day / 2).
/// - На антиподе (lon = 180_000 или -180_000) полдень сдвинут ровно на половину суток.
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

impl SunEvents {
    /// Проверяет, является ли день полярным (солнце не заходит за горизонт)
    pub fn is_polar_day(&self, ticks_per_day: i64) -> bool {
        self.daylight_ticks >= ticks_per_day && ticks_per_day > 0
    }

    /// Проверяет, является ли день полярной ночью (солнце не восходит)
    pub fn is_polar_night(&self) -> bool {
        self.daylight_ticks <= 0
    }
}

/// Контекст астрономических параметров планеты и региона
///
/// Обратите внимание (п. 9.1, 9.2):
/// Все параметры задаются в базисных пунктах (bp, 1 bp = 0.01%) и целочисленных дробях.
/// Вычисления не используют float, тригонометрические библиотеки libm::cos и строго детерминированы.
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
///
/// Хронологический статус (п. 9.1, 9.2):
/// `SunEvents` является презентационно-визуальным интерфейсом для UI (отрисовка карты неба,
/// полосы дня/ночи и расписания сумерек). Он не изменяет дискретный ход абсолютного времени `t_abs`.
///
/// Обработка полярных широт (п. 9.3):
/// - При полярном дне `daylight_ticks == ticks_per_day`, солнце не заходит.
/// - При полярной ночи `daylight_ticks == 0`, солнце не восходит.
/// - Деление на 0 математически исключено благодаря проверкам входных делителей.
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

    // 2. Сезонная волна в диапазоне [-10_000, 10_000] (п. 9.2: чистая целочисленная арифметика)
    // В точке 0 (зима): wave = -10_000
    // В точке 2500 (весеннее равноденствие): wave = 0
    // В точке 5000 (лето): wave = +10_000
    // В точке 7500 (осеннее равноденствие): wave = 0
    let wave = if year_fraction_bp < 5000 {
        let x = year_fraction_bp - 2500; // от -2500 до +2500
        (x * 10_000) / 2500
    } else {
        let x = 7500 - year_fraction_bp; // от +2500 до -2500
        (x * 10_000) / 2500
    };

    let hemisphere_sign = if ctx.is_north_hemisphere { 1 } else { -1 };
    let signed_wave = wave * hemisphere_sign;

    // 3. Длина светового дня в базисных пунктах: строго зажимается в [0, 10_000]
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
