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
