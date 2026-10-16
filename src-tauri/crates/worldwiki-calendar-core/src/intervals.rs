extern crate alloc;
use crate::types::{PrecisionLevel, TimeInterval};
pub use crate::allen::*;

/// Ошибки валидации временных интервалов (п. 12.1, 12.2)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntervalValidationError {
    /// Интервал инвертирован (start > end)
    InvertedInterval,
    /// Пустой полуинтервал (start == end)
    EmptyInterval,
}

/// Уровень серьезности хронологической аномалии (п. 12.4, 12.5)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum AnomalySeverity {
    /// Аномалия отсутствует
    None,
    /// Подозрение (неточные или приблизительные даты, требующие внимания автора)
    Suspect,
    /// Строгое нарушение физики и логики мира (билокация или смерть до рождения)
    Violation,
}

/// Безопасное вычисление длительности интервала в i128 (защита от переполнения i64::MAX - i64::MIN, п. 12.3)
#[inline]
pub fn interval_duration(interval: &TimeInterval) -> u128 {
    if interval.start >= interval.end {
        0
    } else {
        (interval.end as i128 - interval.start as i128) as u128
    }
}

/// Проверяет пересечение двух временных полуинтервалов [start, end) (п. 12.1, 12.3)
///
/// Пустой полуинтервал (start >= end) не содержит точек и не может пересекаться ни с чем.
#[inline]
pub fn intervals_overlap(a: &TimeInterval, b: &TimeInterval) -> bool {
    if a.start >= a.end || b.start >= b.end {
        return false;
    }
    let s = a.start.max(b.start);
    let e = a.end.min(b.end);
    s < e
}

/// Конфликт билокации: персонаж находится в двух разных локациях в пересекающиеся интервалы времени
pub fn check_bilocation(
    scene1_interval: &TimeInterval,
    loc1: &str,
    scene2_interval: &TimeInterval,
    loc2: &str,
) -> bool {
    if loc1 == loc2 {
        return false;
    }
    intervals_overlap(scene1_interval, scene2_interval)
}

/// Конфликт билокации с учетом точности дат (п. 12.4)
///
/// Если дата хотя бы одной сцены имеет точность `PrecisionLevel::Unknown`,
/// пересечение трактуется как подозрение (`AnomalySeverity::Suspect`),
/// а не жесткое нарушение физики мира (`AnomalySeverity::Violation`).
pub fn check_bilocation_with_precision(
    scene1_interval: &TimeInterval,
    prec1: PrecisionLevel,
    loc1: &str,
    scene2_interval: &TimeInterval,
    prec2: PrecisionLevel,
    loc2: &str,
) -> AnomalySeverity {
    if loc1 == loc2 || !intervals_overlap(scene1_interval, scene2_interval) {
        return AnomalySeverity::None;
    }

    if prec1 == PrecisionLevel::Unknown || prec2 == PrecisionLevel::Unknown {
        AnomalySeverity::Suspect
    } else {
        AnomalySeverity::Violation
    }
}

/// Нарушение хронологии жизни: событие с персонажем происходит после его подтвержденной смерти
pub fn check_death_violation(scene_interval: &TimeInterval, death_t_abs: i64) -> bool {
    scene_interval.start > death_t_abs || scene_interval.end > death_t_abs
}

/// Проверяет критическую аномалию жизненного цикла: смерть раньше рождения (п. 12.5)
///
/// Возвращает `AnomalySeverity::Violation` при death_t_abs < birth_t_abs.
pub fn check_lifecycle_anomaly(birth_t_abs: i64, death_t_abs: i64) -> AnomalySeverity {
    if death_t_abs < birth_t_abs {
        AnomalySeverity::Violation
    } else {
        AnomalySeverity::None
    }
}

/// Запись сцены в интервальном индексе персонажей для инкрементального пересчета (п. 16.1)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SceneIntervalEntry<'a> {
    pub scene_id: &'a str,
    pub character_id: &'a str,
    pub location_id: &'a str,
    pub interval: TimeInterval,
    pub precision: PrecisionLevel,
}

/// Инкрементальная проверка билокации для одной модифицированной сцены (п. 16.1, 16.2)
///
/// Вместо O(N^2) полного перебора проверяет только сцены того же персонажа в пересекающемся временном окне.
pub fn check_incremental_bilocation<'a>(
    modified: &SceneIntervalEntry<'a>,
    character_scenes: &[SceneIntervalEntry<'a>],
) -> alloc::vec::Vec<(&'a str, AnomalySeverity)> {
    let mut anomalies = alloc::vec::Vec::new();

    for candidate in character_scenes {
        if candidate.scene_id == modified.scene_id {
            continue;
        }
        if candidate.character_id != modified.character_id {
            continue;
        }

        let severity = check_bilocation_with_precision(
            &modified.interval,
            modified.precision,
            modified.location_id,
            &candidate.interval,
            candidate.precision,
            candidate.location_id,
        );

        if severity != AnomalySeverity::None {
            anomalies.push((candidate.scene_id, severity));
        }
    }

    anomalies
}
