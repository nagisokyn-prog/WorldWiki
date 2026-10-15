use crate::holidays::{is_holiday_active, to_cultural_month, to_internal_month};
use crate::seasons::{find_season_index, is_month_in_season, CoreSeason};
use crate::types::LeapHarmonic;
use crate::weekdays::{calculate_weekday, calculate_weekday_with_pause, WeekdayPauseConfig};

#[kani::proof]
fn proof_weekday_bounded() {
    let cal_day: i64 = kani::any();
    let origin_day: i64 = kani::any();
    let start_weekday: usize = kani::any();
    let count: usize = kani::any();

    kani::assume(cal_day >= -5000 && cal_day <= 5000);
    kani::assume(origin_day >= -5000 && origin_day <= 5000);
    kani::assume(count > 0 && count <= 14); // До 14 дней в неделе
    kani::assume(start_weekday < count);

    let w = calculate_weekday(cal_day, origin_day, start_weekday, count);
    assert!(w < count);
}

#[kani::proof]
fn proof_weekday_periodicity() {
    let cal_day: i64 = kani::any();
    let origin_day: i64 = kani::any();
    let start_weekday: usize = kani::any();
    let count: usize = kani::any();

    kani::assume(cal_day >= -2000 && cal_day <= 2000);
    kani::assume(origin_day >= -2000 && origin_day <= 2000);
    kani::assume(count > 0 && count <= 10);
    kani::assume(start_weekday < count);

    let w1 = calculate_weekday(cal_day, origin_day, start_weekday, count);
    let w2 = calculate_weekday(cal_day + count as i64, origin_day, start_weekday, count);
    assert_eq!(w1, w2);
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_weekday_pause_soundness() {
    let year: i64 = kani::any();
    let day_in_year: i64 = kani::any();
    kani::assume(year >= 1 && year <= 10);
    kani::assume(day_in_year >= 0 && day_in_year < 365);

    let harmonics = [
        LeapHarmonic {
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 4,
            weight: 1,
        },
    ];

    let cfg = WeekdayPauseConfig {
        days_in_regular_months: 360,
        extra_days_base: 5,
        extra_days_leap: 1,
        harmonics: &harmonics,
        origin_year: 1,
        origin_day: 0,
        start_weekday: 0,
        weekdays_count: 7,
    };

    let result = calculate_weekday_with_pause(year, day_in_year, &cfg);
    if day_in_year >= 360 {
        assert!(result.is_none());
    } else {
        assert!(result.is_some());
        assert!(result.unwrap() < 7);
    }
}

#[kani::proof]
fn proof_month_normalization_bijection() {
    let cultural_m: usize = kani::any();
    let m_start: usize = kani::any();
    let total_months: usize = kani::any();

    kani::assume(total_months > 0 && total_months <= 20);
    kani::assume(cultural_m < total_months);
    kani::assume(m_start < total_months);

    let internal = to_internal_month(cultural_m, m_start, total_months);
    assert!(internal < total_months);

    let restored = to_cultural_month(internal, m_start, total_months);
    assert_eq!(cultural_m, restored);
}

#[kani::proof]
fn proof_holiday_boundary_soundness() {
    let sm: usize = kani::any();
    let sd: i64 = kani::any();
    let em: usize = kani::any();
    let ed: i64 = kani::any();

    kani::assume(sm <= 12 && em <= 12);
    kani::assume(sd >= 1 && sd <= 31 && ed >= 1 && ed <= 31);

    // Границы праздника всегда активны
    assert!(is_holiday_active(sm, sd, sm, sd, em, ed));
    assert!(is_holiday_active(em, ed, sm, sd, em, ed));
}

#[kani::proof]
#[kani::unwind(6)]
fn proof_season_detection_soundness() {
    let m: usize = kani::any();
    kani::assume(m < 12);

    let season_summer = CoreSeason {
        name: alloc::string::String::new(),
        color: alloc::string::String::new(),
        months: alloc::vec![5, 6],
    };

    let season_winter = CoreSeason {
        name: alloc::string::String::new(),
        color: alloc::string::String::new(),
        months: alloc::vec![0, 1],
    };

    let seasons = [season_summer, season_winter];

    if let Some(idx) = find_season_index(m, &seasons) {
        assert!(is_month_in_season(m, &seasons[idx]));
    } else {
        assert!(!is_month_in_season(m, &seasons[0]));
        assert!(!is_month_in_season(m, &seasons[1]));
    }
}
