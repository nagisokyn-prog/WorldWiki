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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::DialUnit;
    extern crate alloc;
    use alloc::format;
    use alloc::vec;

    #[test]
    fn test_dial_coverage_internal() {
        let e1 = DialError::ZeroOrNegativeSubdivision;
        let e2 = DialError::CapacityOverflow;
        let e3 = DialError::DuplicateUnitName("u".into());
        let e4 = DialError::TicksNotDivisibleByCapacity {
            ticks_per_day: 10,
            dial_capacity: 3,
        };
        assert_eq!(e1.clone(), e1);
        assert_eq!(e2.clone(), e2);
        assert_eq!(e3.clone(), e3);
        assert_eq!(e4.clone(), e4);
        assert!(e1 != e2);
        assert!(e1 != e3);
        assert!(e1 != e4);
        assert!(e2 != e3);
        assert!(e2 != e4);
        assert!(e3 != e4);
        assert!(e4 != e1);
        // Test different values within same variants
        assert!(e3 != DialError::DuplicateUnitName("v".into()));
        assert!(e4 != DialError::TicksNotDivisibleByCapacity { ticks_per_day: 11, dial_capacity: 3 });
        assert!(e4 != DialError::TicksNotDivisibleByCapacity { ticks_per_day: 10, dial_capacity: 4 });
        let _ = format!("{e1:?}{e2:?}{e3:?}{e4:?}");

        // validate_dial_hierarchy
        assert!(validate_dial_hierarchy(&DialHierarchy { units: vec![] }).is_ok());
        let empty_names = DialHierarchy {
            units: vec![
                DialUnit { name: "".into(), subdivisions: 24 },
                DialUnit { name: "".into(), subdivisions: 60 },
            ],
        };
        assert!(validate_dial_hierarchy(&empty_names).is_ok());
        let dup_names = DialHierarchy {
            units: vec![
                DialUnit { name: "u".into(), subdivisions: 24 },
                DialUnit { name: "u".into(), subdivisions: 60 },
            ],
        };
        assert_eq!(validate_dial_hierarchy(&dup_names), Err(DialError::DuplicateUnitName("u".into())));

        let bad_sub = DialHierarchy {
            units: vec![DialUnit { name: "u".into(), subdivisions: 0 }],
        };
        assert_eq!(validate_dial_hierarchy(&bad_sub), Err(DialError::ZeroOrNegativeSubdivision));

        // validate_dial_bijection
        let valid_h = DialHierarchy {
            units: vec![DialUnit { name: "h".into(), subdivisions: 24 }],
        };
        assert!(validate_dial_bijection(&DialHierarchy { units: vec![] }, 24).is_ok());
        assert_eq!(validate_dial_bijection(&bad_sub, 24), Err(DialError::ZeroOrNegativeSubdivision));
        assert!(validate_dial_bijection(&valid_h, 0).is_ok());
        assert!(validate_dial_bijection(&valid_h, 24).is_ok());
        assert_eq!(
            validate_dial_bijection(&valid_h, 25),
            Err(DialError::TicksNotDivisibleByCapacity { ticks_per_day: 25, dial_capacity: 24 })
        );

        // is_dial_strictly_bijective
        assert!(!is_dial_strictly_bijective(&DialHierarchy { units: vec![] }, 24));
        assert!(!is_dial_strictly_bijective(&valid_h, 0));
        assert!(is_dial_strictly_bijective(&valid_h, 24));
        assert!(!is_dial_strictly_bijective(&valid_h, 25));

        // dial_quantum_remainder
        assert_eq!(dial_quantum_remainder(&DialHierarchy { units: vec![] }, 24), 0);
        assert_eq!(dial_quantum_remainder(&valid_h, 0), 0);
        assert_eq!(dial_quantum_remainder(&valid_h, 24), 0);
        assert_eq!(dial_quantum_remainder(&valid_h, 25), 1);

        // checked_total_dial_subdivisions
        assert_eq!(checked_total_dial_subdivisions(&DialHierarchy { units: vec![] }), Ok(0));
        assert_eq!(checked_total_dial_subdivisions(&valid_h), Ok(24));
        let bad_sub = DialHierarchy {
            units: vec![DialUnit { name: "u".into(), subdivisions: 0 }],
        };
        assert_eq!(checked_total_dial_subdivisions(&bad_sub), Err(DialError::ZeroOrNegativeSubdivision));
        let overflow_sub = DialHierarchy {
            units: vec![
                DialUnit { name: "u1".into(), subdivisions: i64::MAX },
                DialUnit { name: "u2".into(), subdivisions: 2 },
            ],
        };
        assert_eq!(checked_total_dial_subdivisions(&overflow_sub), Err(DialError::CapacityOverflow));

        // dial_capacity
        assert_eq!(dial_capacity(&[]), 0);
        assert_eq!(dial_capacity(&[-1, 10]), 10);

        // total_dial_subdivisions
        assert_eq!(total_dial_subdivisions(&DialHierarchy { units: vec![] }), 0);
        assert_eq!(total_dial_subdivisions(&valid_h), 24);
        let hierarchy = DialHierarchy {
            units: vec![DialUnit { name: "u".into(), subdivisions: -1 }],
        };
        assert_eq!(total_dial_subdivisions(&hierarchy), 1);
    }
}
