use worldwiki_calendar_core::age::calculate_age;
use worldwiki_calendar_core::types::{AgeRule, CalDate};

#[test]
fn test_western_international_age() {
    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };
    let birth = CalDate::new(2000, 5, 15);

    // До дня рождения в 2024
    let age_before = calculate_age(birth, CalDate::new(2024, 5, 14), &rule, 31);
    assert_eq!(age_before, 23);

    // В день рождения в 2024
    let age_on = calculate_age(birth, CalDate::new(2024, 5, 15), &rule, 31);
    assert_eq!(age_on, 24);

    // После дня рождения в 2024
    let age_after = calculate_age(birth, CalDate::new(2024, 5, 16), &rule, 31);
    assert_eq!(age_after, 24);
}

#[test]
fn test_korean_traditional_and_year_age() {
    let birth = CalDate::new(2000, 12, 31);

    // 1. Корейский традиционный возраст (Korean Age): 1 при рождении, +1 1 января
    let korean_rule = AgeRule {
        age_at_birth: 1,
        step_on_new_year: true,
        year_only: false,
    };
    // В день рождения (31 декабря 2000) ребенку уже 1 год!
    assert_eq!(calculate_age(birth, CalDate::new(2000, 12, 31), &korean_rule, 31), 1);
    // На следующий день (1 января 2001) ребенку исполняется 2 года!
    assert_eq!(calculate_age(birth, CalDate::new(2001, 1, 1), &korean_rule, 31), 2);

    // 2. Счетный/призывной возраст (Year Age): 0 при рождении, +1 1 января
    let year_age_rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: true,
        year_only: true,
    };
    assert_eq!(calculate_age(birth, CalDate::new(2000, 12, 31), &year_age_rule, 31), 0);
    assert_eq!(calculate_age(birth, CalDate::new(2001, 1, 1), &year_age_rule, 31), 1);
    assert_eq!(calculate_age(birth, CalDate::new(2024, 6, 1), &year_age_rule, 31), 24);
}

#[test]
fn test_leap_birthday_february_29() {
    let rule = AgeRule {
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
    };
    let birth = CalDate::new(2000, 2, 29);

    // В невисокосном 2001 году в феврале 28 дней
    let age_feb27 = calculate_age(birth, CalDate::new(2001, 2, 27), &rule, 28);
    let age_feb28 = calculate_age(birth, CalDate::new(2001, 2, 28), &rule, 28);
    let age_mar01 = calculate_age(birth, CalDate::new(2001, 3, 1), &rule, 31);

    assert_eq!(age_feb27, 0);
    assert_eq!(age_feb28, 1, "29 Feb birthday clamped to 28 Feb in non-leap year");
    assert_eq!(age_mar01, 1);
}

#[test]
fn test_age_before_birth_negative() {
    let rule = AgeRule::default();
    let birth = CalDate::new(2000, 5, 10);
    let before = CalDate::new(1995, 5, 10);

    let age = calculate_age(birth, before, &rule, 31);
    assert!(age < 0);
    assert_eq!(age, -6);
}
