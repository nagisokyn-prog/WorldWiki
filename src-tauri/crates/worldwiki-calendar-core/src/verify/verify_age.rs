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

#[kani::proof]
fn proof_age_extra_day_birth() {
    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };

    // Родился в 6-й эпагоменальный день (високосный) 13-го месяца
    let birth = CalDate::new(2000, 13, 6);

    // В невисокосном 2001 году в эпагоменах только 5 дней:
    let age_before = calculate_age(birth, CalDate::new(2001, 13, 4), &rule, 5);
    let age_on = calculate_age(birth, CalDate::new(2001, 13, 5), &rule, 5);

    assert_eq!(age_before, 0);
    assert_eq!(age_on, 1);
}

#[kani::proof]
fn proof_age_birth_day_zero_or_negative_safe() {
    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };

    // Невалидный день 0 или -5 не должен приводить к панике или сбою
    let birth_zero = CalDate::new(2000, 5, 0);
    let age = calculate_age(birth_zero, CalDate::new(2005, 5, 10), &rule, 30);
    assert_eq!(age, 5);
}

#[kani::proof]
fn proof_age_negative_before_birth() {
    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };

    let birth = CalDate::new(2020, 6, 1);
    let current_before = CalDate::new(2018, 6, 1);
    let age = calculate_age(birth, current_before, &rule, 30);
    assert!(age < 0);
}

#[kani::proof]
fn proof_age_new_year_step_january_1() {
    let rule = AgeRule {
        age_at_birth: 1, // Традиционный восточноазиатский возраст
        step_on_new_year: true,
        year_only: false,
    };

    // Родился 1 января 2000 года
    let birth = CalDate::new(2000, 1, 1);

    // 1 января 2000 года: возраст 1 год
    assert_eq!(calculate_age(birth, CalDate::new(2000, 1, 1), &rule, 31), 1);
    // 2 января 2000 года: возраст все еще 1 год (год не сменился)
    assert_eq!(calculate_age(birth, CalDate::new(2000, 1, 2), &rule, 31), 1);
    // 1 января 2001 года: наступает 2 года
    assert_eq!(calculate_age(birth, CalDate::new(2001, 1, 1), &rule, 31), 2);
}

#[kani::proof]
fn proof_age_birth_day_nonnegative() {
    let day: i64 = kani::any();
    kani::assume(day >= -100 && day <= 100);

    let rule = AgeRule::default();
    let birth = CalDate::new(2000, 1, day);
    let curr = CalDate::new(2010, 1, 15);

    let age = calculate_age(birth, curr, &rule, 30);
    assert!(age >= 0);
}

#[kani::proof]
fn proof_age_birth_month_bounded() {
    let month: usize = kani::any();
    kani::assume(month >= 1 && month <= 13);

    let rule = AgeRule::default();
    let birth = CalDate::new(2000, month, 10);
    let curr = CalDate::new(2005, month, 10);

    let age = calculate_age(birth, curr, &rule, 30);
    assert_eq!(age, 5);
}

#[kani::proof]
fn proof_age_first_month_zero_length() {
    let rule = AgeRule::default();
    // Рождение в месяце 1, если в текущем году в месяце 1 ровно 0 дней (экзотический календарь)
    let birth = CalDate::new(2000, 1, 10);
    let curr = CalDate::new(2005, 2, 10);

    let age = calculate_age(birth, curr, &rule, 0);
    assert_eq!(age, 5);
}

