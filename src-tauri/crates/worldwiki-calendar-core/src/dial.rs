extern crate alloc;
use alloc::vec::Vec;
use crate::leap::floor_div;
use crate::types::DialHierarchy;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DialError {
    ZeroOrNegativeSubdivision,
    CapacityOverflow,
    DuplicateUnitName(alloc::string::String),
    TicksNotDivisibleByCapacity { ticks_per_day: i64, dial_capacity: i64 },
}

/// Проверяет инвариант циферблата:
/// 1. Все единицы обязаны иметь строго положительное деление (subdivisions > 0)
/// 2. Произведение всех делений не должно переполнять i64
/// 3. Имена единиц времени обязаны быть уникальными
#[inline]
pub fn validate_dial_hierarchy(hierarchy: &DialHierarchy) -> Result<(), DialError> {
    checked_total_dial_subdivisions(hierarchy)?;

    for i in 0..hierarchy.units.len() {
        let name_i = &hierarchy.units[i].name;
        if !name_i.is_empty() {
            for j in (i + 1)..hierarchy.units.len() {
                if name_i == &hierarchy.units[j].name {
                    return Err(DialError::DuplicateUnitName(name_i.clone()));
                }
            }
        }
    }
    Ok(())
}

/// Проверяет строгую биективность квантования: ticks_per_day делится нацело на dial_capacity
#[inline]
pub fn validate_dial_bijection(hierarchy: &DialHierarchy, ticks_per_day: i64) -> Result<(), DialError> {
    let cap = checked_total_dial_subdivisions(hierarchy)?;
    if cap > 0 && ticks_per_day > 0 && ticks_per_day % cap != 0 {
        return Err(DialError::TicksNotDivisibleByCapacity {
            ticks_per_day,
            dial_capacity: cap,
        });
    }
    Ok(())
}

/// Проверяет, является ли квантование циферблата строго биективным для суток планеты
#[inline]
pub fn is_dial_strictly_bijective(hierarchy: &DialHierarchy, ticks_per_day: i64) -> bool {
    let cap = total_dial_subdivisions(hierarchy);
    if cap <= 0 || ticks_per_day <= 0 {
        return false;
    }
    ticks_per_day % cap == 0
}

/// Вычисляет квантовую погрешность циферблата в тиках планеты (0 = идеальная точность без мертвых зон)
#[inline]
pub fn dial_quantum_remainder(hierarchy: &DialHierarchy, ticks_per_day: i64) -> i64 {
    let cap = total_dial_subdivisions(hierarchy);
    if cap <= 0 || ticks_per_day <= 0 {
        return 0;
    }
    ticks_per_day % cap
}

/// Безопасный расчет полной емкости циферблата в i128 с детекцией переполнения i64
#[inline]
pub fn checked_total_dial_subdivisions(hierarchy: &DialHierarchy) -> Result<i64, DialError> {
    if hierarchy.units.is_empty() {
        return Ok(0);
    }
    let mut cap: i128 = 1;
    for u in &hierarchy.units {
        if u.subdivisions <= 0 {
            return Err(DialError::ZeroOrNegativeSubdivision);
        }
        cap = cap
            .checked_mul(u.subdivisions as i128)
            .ok_or(DialError::CapacityOverflow)?;
        if cap > i64::MAX as i128 {
            return Err(DialError::CapacityOverflow);
        }
    }
    Ok(cap as i64)
}

/// Вычисление полной емкости циферблата в младших единицах
#[inline]
pub fn dial_capacity(subdivisions: &[i64]) -> i64 {
    if subdivisions.is_empty() {
        return 0;
    }
    let mut cap = 1i64;
    for &sub in subdivisions {
        if sub > 0 {
            cap = cap.saturating_mul(sub);
        }
    }
    cap
}

/// Вычисление полной емкости циферблата из иерархии
#[inline]
pub fn total_dial_subdivisions(hierarchy: &DialHierarchy) -> i64 {
    if hierarchy.units.is_empty() {
        return 0;
    }
    let mut cap = 1i64;
    for u in &hierarchy.units {
        if u.subdivisions > 0 {
            cap = cap.saturating_mul(u.subdivisions);
        }
    }
    cap
}

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
