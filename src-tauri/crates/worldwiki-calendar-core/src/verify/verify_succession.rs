use crate::succession::find_active_calendar_era;
use crate::types::{CalendarStyleEra, CalendarSuccession, ReformMode};
use alloc::string::String;
use alloc::vec;

#[kani::proof]
fn proof_succession_two_eras_exhaustive() {
    let m_abs: i64 = kani::any();
    kani::assume(m_abs >= 0 && m_abs <= 200_000);

    let succession = CalendarSuccession {
        eras: vec![
            CalendarStyleEra {
                calendar_id: String::new(),
                effective_from_m_abs: 0,
                effective_to_m_abs: Some(100_000),
                reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
            },
            CalendarStyleEra {
                calendar_id: String::new(),
                effective_from_m_abs: 100_001,
                effective_to_m_abs: None,
                reform_mode: ReformMode::DiscontinuousGap { dropped_days: 10 },
            },
        ],
    };

    if let Ok(era) = find_active_calendar_era(&succession, m_abs) {
        if m_abs <= 100_000 {
            assert_eq!(era.effective_from_m_abs, 0);
        } else {
            assert_eq!(era.effective_from_m_abs, 100_001);
        }
    } else {
        assert!(false, "Era must be found within valid bounds");
    }
}
