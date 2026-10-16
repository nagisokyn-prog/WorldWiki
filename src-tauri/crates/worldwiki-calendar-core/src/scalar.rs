use crate::types::{FastLocalMoment, LocalMoment, PlanetKey};
extern crate alloc;
use alloc::string::ToString;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScalarError {
    Overflow,
    DivisionByZero,
}

/// Минимальный и максимальный допустимый предел времени Вселенной.
/// Физические границы шкалы t_abs (i64):
/// - При минутной точности (WorldWiki default, 1 тик = 1 мин): ±1.75 * 10^13 лет (17.5 триллионов лет, возраст Вселенной ~ 1.38 * 10^10 лет)
/// - При секундной точности: ±292 миллиарда лет (полностью покрывает возраст Вселенной)
/// - При миллисекундной точности: ±292 миллиона лет
/// - При микросекундной точности: ±292 тысячи лет
pub const MIN_T_ABS: i64 = i64::MIN;
pub const MAX_T_ABS: i64 = i64::MAX;

/// Проверяет, что абсолютный скаляр времени t_abs не выходит за допустимый диапазон i64
#[inline]
pub fn validate_t_abs_bound(t_abs: i64) -> bool {
    t_abs > MIN_T_ABS && t_abs < MAX_T_ABS
}

/// Евклидово деление с остатком для целочисленных координат
#[inline]
pub fn euclidean_div_rem(a: i64, b: i64) -> (i64, i64) {
    (a.div_euclid(b), a.rem_euclid(b))
}

/// Нормализация смещения начала суток строго в полуинтервал [0, ticks_per_day).
/// Исключает баги при экстремальном пользовательском вводе (|offset| >= ticks_per_day).
#[inline]
pub fn normalize_day_start_offset(offset: i64, ticks_per_day: i64) -> i64 {
    if ticks_per_day <= 0 {
        0
    } else {
        offset.rem_euclid(ticks_per_day)
    }
}

/// Безопасное преобразование t_abs в LocalMoment с проверкой переполнений
#[inline]
pub fn try_t_abs_to_local_moment(
    t_abs: i64,
    planet_id: &str,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> Result<LocalMoment, ScalarError> {
    if ticks_per_day == 0 {
        return Err(ScalarError::DivisionByZero);
    }
    let norm_offset = normalize_day_start_offset(day_start_offset, ticks_per_day);
    let shifted = (t_abs as i128)
        .checked_sub(norm_offset as i128)
        .ok_or(ScalarError::Overflow)?;

    let ticks = ticks_per_day as i128;
    let world_day = shifted.div_euclid(ticks);
    let day_tick = shifted.rem_euclid(ticks);

    let world_day_i64 = i64::try_from(world_day).map_err(|_| ScalarError::Overflow)?;
    let day_tick_i64 = i64::try_from(day_tick).map_err(|_| ScalarError::Overflow)?;

    Ok(LocalMoment {
        planet_id: planet_id.to_string(),
        world_day: world_day_i64,
        day_tick: day_tick_i64,
    })
}

/// Преобразование вселенского скаляра t_abs в физические сутки и тик планеты
/// с защитой от паник при переполнении
#[inline]
pub fn t_abs_to_local_moment(
    t_abs: i64,
    planet_id: &str,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> LocalMoment {
    try_t_abs_to_local_moment(t_abs, planet_id, ticks_per_day, day_start_offset).unwrap_or_else(|_| {
        let shifted = (t_abs as i128) - (day_start_offset as i128);
        let ticks = if ticks_per_day != 0 { ticks_per_day as i128 } else { 1 };
        let world_day = shifted.div_euclid(ticks);
        let day_tick = shifted.rem_euclid(ticks);
        LocalMoment {
            planet_id: planet_id.to_string(),
            world_day: world_day.clamp(i64::MIN as i128, i64::MAX as i128) as i64,
            day_tick: day_tick.clamp(i64::MIN as i128, i64::MAX as i128) as i64,
        }
    })
}

/// Безопасное восстановление t_abs из LocalMoment с явной ошибкой переполнения
#[inline]
pub fn try_local_moment_to_t_abs(
    moment: &LocalMoment,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> Result<i64, ScalarError> {
    let norm_offset = normalize_day_start_offset(day_start_offset, ticks_per_day);
    let day_prod = (moment.world_day as i128)
        .checked_mul(ticks_per_day as i128)
        .ok_or(ScalarError::Overflow)?;
    let raw = day_prod
        .checked_add(moment.day_tick as i128)
        .ok_or(ScalarError::Overflow)?;
    let total = raw
        .checked_add(norm_offset as i128)
        .ok_or(ScalarError::Overflow)?;

    i64::try_from(total).map_err(|_| ScalarError::Overflow)
}

/// Восстановление вселенского скаляра t_abs из LocalMoment планеты
/// с гарантированным насыщением (clamping) без переполнения и UB
#[inline]
pub fn local_moment_to_t_abs(
    moment: &LocalMoment,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> i64 {
    try_local_moment_to_t_abs(moment, ticks_per_day, day_start_offset).unwrap_or_else(|_| {
        let norm_offset = normalize_day_start_offset(day_start_offset, ticks_per_day);
        let total = (moment.world_day as i128)
            .saturating_mul(ticks_per_day as i128)
            .saturating_add(moment.day_tick as i128)
            .saturating_add(norm_offset as i128);
        total.clamp(i64::MIN as i128, i64::MAX as i128) as i64
    })
}

/// Прямое применение смещения начала суток с нормализацией
#[inline]
pub fn apply_day_start_offset(t_abs: i64, offset: i64, ticks_per_day: i64) -> i64 {
    let norm_offset = normalize_day_start_offset(offset, ticks_per_day);
    t_abs.saturating_add(norm_offset)
}

/// Обратное восстановление смещения начала суток с нормализацией
#[inline]
pub fn revert_day_start_offset(shifted: i64, offset: i64, ticks_per_day: i64) -> i64 {
    let norm_offset = normalize_day_start_offset(offset, ticks_per_day);
    shifted.saturating_sub(norm_offset)
}

/// Преобразование t_abs в компактный FastLocalMoment без аллокаций строк (Zero-Allocation)
#[inline]
pub fn t_abs_to_fast_moment(
    t_abs: i64,
    planet_key: PlanetKey,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> FastLocalMoment {
    let norm_offset = normalize_day_start_offset(day_start_offset, ticks_per_day);
    let shifted = (t_abs as i128) - (norm_offset as i128);
    let ticks = if ticks_per_day != 0 { ticks_per_day as i128 } else { 1 };
    let world_day = shifted.div_euclid(ticks);
    let day_tick = shifted.rem_euclid(ticks);
    FastLocalMoment {
        planet_key,
        world_day: world_day.clamp(i64::MIN as i128, i64::MAX as i128) as i64,
        day_tick: day_tick.clamp(i64::MIN as i128, i64::MAX as i128) as i64,
    }
}

/// Восстановление t_abs из FastLocalMoment без аллокаций строк
#[inline]
pub fn fast_moment_to_t_abs(
    moment: FastLocalMoment,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> i64 {
    let norm_offset = normalize_day_start_offset(day_start_offset, ticks_per_day);
    let total = (moment.world_day as i128)
        .saturating_mul(ticks_per_day as i128)
        .saturating_add(moment.day_tick as i128)
        .saturating_add(norm_offset as i128);
    total.clamp(i64::MIN as i128, i64::MAX as i128) as i64
}

