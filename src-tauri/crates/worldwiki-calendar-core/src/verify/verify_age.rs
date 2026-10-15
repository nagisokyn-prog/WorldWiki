use crate::age::calculate_age;
use crate::eras::compare_dates;
use crate::types::{AgeRule, CalDate};

#[kani::proof]
fn proof_age_non_negative_after_birth() {
    let birth_y: i64 = kani::any();
    let birth_m: usize = kani::any();
    let birth_d: i64 = kani::any();

    let curr_y: i64 = kani::any();
    let curr_m: usize = kani::any();
    let curr_d: i64 = kani::any();

    kani::assume(birth_y >= 1000 && birth_y <= 2000);
    kani::assume(birth_m >= 1 && birth_m <= 12);
    kani::assume(birth_d >= 1 && birth_d <= 30);

    kani::assume(curr_y >= birth_y && curr_y <= 2500);
    kani::assume(curr_m >= 1 && curr_m <= 12);
    kani::assume(curr_d >= 1 && curr_d <= 30);

    kani::assume(compare_dates(curr_y, curr_m, curr_d, birth_y, birth_m, birth_d).is_ge());

    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };

    let age = calculate_age(
        CalDate::new(birth_y, birth_m, birth_d),
        CalDate::new(curr_y, curr_m, curr_d),
        &rule,
        30,
    );
    assert!(age >= 0);
}

#[kani::proof]
fn proof_age_monotonic() {
    let birth = CalDate::new(1000, 5, 10);

    let y1: i64 = kani::any();
    let y2: i64 = kani::any();
    kani::assume(y1 >= 1000 && y1 <= y2 && y2 <= 2500);

    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };

    let age1 = calculate_age(birth, CalDate::new(y1, 5, 10), &rule, 30);
    let age2 = calculate_age(birth, CalDate::new(y2, 5, 10), &rule, 30);

    assert!(age1 <= age2);
}

#[kani::proof]
fn proof_leap_birthday_clamped() {
    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };

    // Родился 29 февраля 2000
    let birth = CalDate::new(2000, 2, 29);

    // В 2001 году в феврале 28 дней
    let age_before = calculate_age(birth, CalDate::new(2001, 2, 27), &rule, 28);
    let age_on = calculate_age(birth, CalDate::new(2001, 2, 28), &rule, 28);
    let age_after = calculate_age(birth, CalDate::new(2001, 3, 1), &rule, 31);

    assert_eq!(age_before, 0);
    assert_eq!(age_on, 1);
    assert_eq!(age_after, 1);
}
