use worldwiki_calendar_core::leap::{days_in_year, days_up_to_year};
use worldwiki_calendar_core::types::LeapHarmonic;
use worldwiki_calendar_core::year_finder::year_from_days_o1;

#[test]
fn test_year_from_days_o1_gregorian_exact_bijection() {
    let harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];
    let base = 365;
    let offset = 1;

    // Проверяем широкий диапазон лет от -5000 до +5000 с шагом и граничными точками
    let test_years = [
        -10000, -5000, -2000, -400, -100, -4, -1, 0, 1, 2, 3, 4,
        100, 399, 400, 401, 1900, 1999, 2000, 2001, 2004, 2024,
        2100, 2400, 5000, 10000, 100000,
    ];

    for &y in &test_years {
        let len = days_in_year(y, base, offset, &harmonics);
        let days_before = days_up_to_year(y, base, offset, &harmonics);

        // Проверяем первый день года, середину и последний день года
        let test_days = [0, len / 2, len - 1];
        for &d_in_y in &test_days {
            let total_days = days_before + d_in_y;
            let (recovered_y, recovered_d) = year_from_days_o1(total_days, base, &harmonics, offset);
            assert_eq!(recovered_y, y, "Year mismatch for day {total_days}");
            assert_eq!(recovered_d, d_in_y, "Day in year mismatch for day {total_days}");
        }
    }
}

#[test]
fn test_year_from_days_o1_no_harmonics() {
    // Календарь без високосных лет (Древний Египет, 365 дней строго)
    let harmonics: Vec<LeapHarmonic> = vec![];
    let base = 365;

    for y in -200..200 {
        let days_before = days_up_to_year(y, base, 0, &harmonics);
        let (rec_y, rec_d) = year_from_days_o1(days_before + 100, base, &harmonics, 0);
        assert_eq!(rec_y, y);
        assert_eq!(rec_d, 100);
    }
}
