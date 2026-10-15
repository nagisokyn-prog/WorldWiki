use crate::types::LocalMoment;
extern crate alloc;
use alloc::string::ToString;

/// Евклидово деление с остатком для целочисленных координат
#[inline]
pub fn euclidean_div_rem(a: i64, b: i64) -> (i64, i64) {
    (a.div_euclid(b), a.rem_euclid(b))
}

/// Преобразование вселенского скаляра t_abs в физические сутки и тик планеты
/// с учетом смещения начала суток (day_start_offset)
#[inline]
pub fn t_abs_to_local_moment(
    t_abs: i64,
    planet_id: &str,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> LocalMoment {
    let shifted = t_abs - day_start_offset;
    let (world_day, day_tick) = euclidean_div_rem(shifted, ticks_per_day);
    LocalMoment {
        planet_id: planet_id.to_string(),
        world_day,
        day_tick,
    }
}

/// Восстановление вселенского скаляра t_abs из LocalMoment планеты
#[inline]
pub fn local_moment_to_t_abs(
    moment: &LocalMoment,
    ticks_per_day: i64,
    day_start_offset: i64,
) -> i64 {
    let raw = (moment.world_day as i128 * ticks_per_day as i128 + moment.day_tick as i128) as i64;
    raw + day_start_offset
}

/// Прямое применение смещения начала суток
#[inline]
pub fn apply_day_start_offset(t_abs: i64, offset: i64, _ticks_per_day: i64) -> i64 {
    t_abs.saturating_add(offset)
}

/// Обратное восстановление смещения начала суток
#[inline]
pub fn revert_day_start_offset(shifted: i64, offset: i64, _ticks_per_day: i64) -> i64 {
    shifted.saturating_sub(offset)
}
