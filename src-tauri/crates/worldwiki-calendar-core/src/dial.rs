extern crate alloc;
use crate::types::DialHierarchy;
pub use crate::dial_quantize::*;

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

    for (i, u) in hierarchy.units.iter().enumerate() {
        let name_i = &u.name;
        if !name_i.is_empty() {
            for other in hierarchy.units.iter().skip(i + 1) {
                if name_i == &other.name {
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
        cap *= u.subdivisions as i128;
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
