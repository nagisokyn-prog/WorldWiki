extern crate alloc;
use crate::types::TimeInterval;

/// 13 взаимно-исключающих отношений интервальной алгебры Аллена
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AllenRelation {
    Before,       // A строго до B (A.end < B.start)
    Meets,        // A примыкает к B слева (A.end == B.start)
    Overlaps,     // A перекрывает начало B (A.start < B.start < A.end < B.end)
    Starts,       // A начинается одновременно с B, но короче (A.start == B.start && A.end < B.end)
    During,       // A строго внутри B (A.start > B.start && A.end < B.end)
    Finishes,     // A заканчивается одновременно с B, но короче (A.start > B.start && A.end == B.end)
    Equals,       // A совпадает с B (A.start == B.start && A.end == B.end)
    FinishedBy,   // B заканчивается одновременно с A, но B короче (обратно Finishes)
    Contains,     // B строго внутри A (обратно During)
    StartedBy,    // B начинается одновременно с A, но B короче (обратно Starts)
    OverlappedBy, // B перекрывает начало A (обратно Overlaps)
    MetBy,        // B примыкает к A слева (обратно Meets)
    After,        // A строго после B (A.start > B.end)
}

/// Вычисляет точное отношение интервальной алгебры Аллена между двумя полуоткрытыми интервалами [start, end)
pub fn allen_relation(a: &TimeInterval, b: &TimeInterval) -> AllenRelation {
    let s1 = a.start;
    let e1 = a.end;
    let s2 = b.start;
    let e2 = b.end;

    if e1 < s2 {
        AllenRelation::Before
    } else if e1 == s2 {
        AllenRelation::Meets
    } else if s1 > e2 {
        AllenRelation::After
    } else if s1 == e2 {
        AllenRelation::MetBy
    } else if s1 == s2 && e1 == e2 {
        AllenRelation::Equals
    } else if s1 == s2 {
        if e1 < e2 {
            AllenRelation::Starts
        } else {
            AllenRelation::StartedBy
        }
    } else if e1 == e2 {
        if s1 > s2 {
            AllenRelation::Finishes
        } else {
            AllenRelation::FinishedBy
        }
    } else if s1 < s2 {
        if e1 > e2 {
            AllenRelation::Contains
        } else {
            AllenRelation::Overlaps
        }
    } else {
        // s1 > s2
        if e1 < e2 {
            AllenRelation::During
        } else {
            AllenRelation::OverlappedBy
        }
    }
}

/// Проверяет пересечение двух временных интервалов: max(s1, s2) < min(e1, e2)
#[inline]
pub fn intervals_overlap(a: &TimeInterval, b: &TimeInterval) -> bool {
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

/// Нарушение хронологии жизни: событие с персонажем происходит после его подтвержденной смерти
pub fn check_death_violation(scene_interval: &TimeInterval, death_t_abs: i64) -> bool {
    scene_interval.start > death_t_abs || scene_interval.end > death_t_abs
}
