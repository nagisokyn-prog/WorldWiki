extern crate alloc;
use alloc::vec::Vec;
use crate::leap::floor_div;
use crate::types::DialHierarchy;
use crate::dial::total_dial_subdivisions;

/// Прямой перевод вектора значений единиц циферблата в физический тик суток:
/// При ticks_per_day >= total_dial_subdivisions использует ceil для сохранения круговой обратимости без потери квантов
pub fn units_to_day_tick(
    values: &[i64],
    hierarchy: &DialHierarchy,
    ticks_per_day: i64,
) -> i64 {
    let cap = total_dial_subdivisions(hierarchy);
    if cap <= 1 || values.is_empty() || hierarchy.units.is_empty() {
        return 0;
    }

    let mut units_of_day = values.first().copied().unwrap_or(0);
    let limit = values.len().min(hierarchy.units.len());
    for i in 1..limit {
        let sub = hierarchy.units.get(i).map(|u| u.subdivisions).unwrap_or(1);
        let val = values.get(i).copied().unwrap_or(0);
        units_of_day = units_of_day * sub + val;
    }

    let numer = (units_of_day as i128) * (ticks_per_day as i128) + (cap as i128) - 1;
    numer.div_euclid(cap as i128) as i64
}

/// Обратное разложение физического тика суток в вектор значений циферблата через floor
pub fn day_tick_to_units(
    day_tick: i64,
    hierarchy: &DialHierarchy,
    ticks_per_day: i64,
) -> Vec<i64> {
    let count = hierarchy.units.len();
    if count == 0 {
        return Vec::new();
    }
    let cap = total_dial_subdivisions(hierarchy);
    if cap <= 1 || ticks_per_day <= 0 {
        return alloc::vec![0; count];
    }

    let safe_tick = day_tick.clamp(0, ticks_per_day.saturating_sub(1));
    let numer = (safe_tick as i128) * (cap as i128);
    let mut units_of_day = numer.div_euclid(ticks_per_day as i128) as i64;

    let mut out = alloc::vec![0; count];
    for i in (1..count).rev() {
        let sub = hierarchy.units.get(i).map(|u| u.subdivisions).unwrap_or(1);
        if sub > 0 {
            if let Some(target) = out.get_mut(i) {
                *target = units_of_day.rem_euclid(sub);
            }
            units_of_day = floor_div(units_of_day, sub);
        }
    }
    if let Some(target) = out.get_mut(0) {
        *target = units_of_day;
    }
    out
}
