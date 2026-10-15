use worldwiki_calendar_core::intervals::*;
use worldwiki_calendar_core::types::TimeInterval;

#[test]
fn test_allen_algebra_all_relations() {
    let a = TimeInterval { start: 10, end: 20 };

    // 1. Before: b строго после a
    assert_eq!(allen_relation(&a, &TimeInterval { start: 25, end: 35 }), AllenRelation::Before);
    // 2. After: b строго до a
    assert_eq!(allen_relation(&a, &TimeInterval { start: 0, end: 5 }), AllenRelation::After);
    // 3. Meets: a завершается ровно в момент старта b
    assert_eq!(allen_relation(&a, &TimeInterval { start: 20, end: 30 }), AllenRelation::Meets);
    // 4. MetBy: b завершается ровно в момент старта a
    assert_eq!(allen_relation(&a, &TimeInterval { start: 0, end: 10 }), AllenRelation::MetBy);
    // 5. Overlaps: a начинается до b и пересекается
    assert_eq!(allen_relation(&a, &TimeInterval { start: 15, end: 25 }), AllenRelation::Overlaps);
    // 6. OverlappedBy
    assert_eq!(allen_relation(&a, &TimeInterval { start: 5, end: 15 }), AllenRelation::OverlappedBy);
    // 7. Starts: одинаковое начало, a короче b
    assert_eq!(allen_relation(&a, &TimeInterval { start: 10, end: 30 }), AllenRelation::Starts);
    // 8. StartedBy: одинаковое начало, a длиннее b
    assert_eq!(allen_relation(&a, &TimeInterval { start: 10, end: 15 }), AllenRelation::StartedBy);
    // 9. During: a строго внутри b
    assert_eq!(allen_relation(&a, &TimeInterval { start: 5, end: 25 }), AllenRelation::During);
    // 10. Contains: b строго внутри a
    assert_eq!(allen_relation(&a, &TimeInterval { start: 12, end: 18 }), AllenRelation::Contains);
    // 11. Finishes: одинаковый конец, a короче b
    assert_eq!(allen_relation(&a, &TimeInterval { start: 5, end: 20 }), AllenRelation::Finishes);
    // 12. FinishedBy: одинаковый конец, a длиннее b
    assert_eq!(allen_relation(&a, &TimeInterval { start: 15, end: 20 }), AllenRelation::FinishedBy);
    // 13. Equals: полное совпадение
    assert_eq!(allen_relation(&a, &TimeInterval { start: 10, end: 20 }), AllenRelation::Equals);
}

#[test]
fn test_intervals_overlap() {
    assert!(intervals_overlap(&TimeInterval { start: 10, end: 20 }, &TimeInterval { start: 15, end: 25 }));
    assert!(intervals_overlap(&TimeInterval { start: 10, end: 20 }, &TimeInterval { start: 10, end: 20 }));
    assert!(!intervals_overlap(&TimeInterval { start: 10, end: 20 }, &TimeInterval { start: 20, end: 30 })); // Касание концами - не пересечение
    assert!(!intervals_overlap(&TimeInterval { start: 10, end: 20 }, &TimeInterval { start: 25, end: 30 }));
}

#[test]
fn test_bilocation_conflict() {
    let event1 = TimeInterval { start: 100, end: 200 };
    let event2 = TimeInterval { start: 150, end: 250 };
    let event3 = TimeInterval { start: 300, end: 400 };

    // Персонаж в двух разных локациях в пересекающееся время -> конфликт
    assert!(check_bilocation(&event1, "Tatooine", &event2, "Coruscant"));
    // Тот же персонаж в той же локации -> нет конфликта
    assert!(!check_bilocation(&event1, "Tatooine", &event2, "Tatooine"));
    // Непересекающиеся времена -> нет конфликта
    assert!(!check_bilocation(&event1, "Tatooine", &event3, "Coruscant"));
}

#[test]
fn test_death_violation() {
    let death_moment = 1000;

    let event_alive = TimeInterval { start: 800, end: 950 };
    let event_cross_death = TimeInterval { start: 950, end: 1050 };
    let event_after_death = TimeInterval { start: 1200, end: 1300 };

    assert!(!check_death_violation(&event_alive, death_moment));
    assert!(check_death_violation(&event_cross_death, death_moment));
    assert!(check_death_violation(&event_after_death, death_moment));
}
