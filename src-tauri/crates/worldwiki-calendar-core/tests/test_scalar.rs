use worldwiki_calendar_core::scalar::*;

#[test]
fn test_euclidean_div_rem_positive() {
    assert_eq!(euclidean_div_rem(10, 3), (3, 1));
    assert_eq!(euclidean_div_rem(100, 24), (4, 4));
    assert_eq!(euclidean_div_rem(86400, 86400), (1, 0));
}

#[test]
fn test_euclidean_div_rem_negative() {
    // В кольце вычетов остаток всегда неотрицателен: -1 = (-1)*3 + 2
    assert_eq!(euclidean_div_rem(-1, 3), (-1, 2));
    assert_eq!(euclidean_div_rem(-10, 3), (-4, 2));
    assert_eq!(euclidean_div_rem(-86400, 86400), (-1, 0));
    assert_eq!(euclidean_div_rem(-100, 86400), (-1, 86300));
}

#[test]
fn test_t_abs_to_local_moment_and_back_bijection() {
    let test_cases = [
        (0i64, 86400i64, 0i64),
        (100, 86400, 0),
        (-100, 86400, 0),
        (86399, 86400, 0),
        (86400, 86400, 0),
        (-86400, 86400, 0),
        (123456789, 86400, 21600),
        (-123456789, 86400, 21600),
        (5000000, 122400, 10000), // Татуин: 34-часовые сутки
    ];

    for (t_abs, ticks, offset) in test_cases {
        let moment = t_abs_to_local_moment(t_abs, "earth", ticks, offset);
        assert!(moment.day_tick >= 0);
        assert!(moment.day_tick < ticks);

        let restored = local_moment_to_t_abs(&moment, ticks, offset);
        assert_eq!(restored, t_abs, "Failed bijection for t_abs: {t_abs}");
    }
}

#[test]
fn test_day_start_offset_symmetry() {
    let t = 45000;
    let offset = 21600;
    let ticks = 86400;

    let shifted = apply_day_start_offset(t, offset, ticks);
    let reverted = revert_day_start_offset(shifted, offset, ticks);
    assert_eq!(reverted, t);
}
