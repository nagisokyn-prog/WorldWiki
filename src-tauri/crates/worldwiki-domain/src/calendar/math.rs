use crate::calendar::models::{CalendarData, DateCoordinate};
use worldwiki_calendar_core::{self as core, DialHierarchy};

pub struct CalendarMath;

impl CalendarMath {
    pub fn is_leap_year(calendar: &CalendarData, year: i32) -> bool {
        let harmonics = calendar.get_harmonics();
        if harmonics.is_empty() {
            return false;
        }
        core::is_leap_year(year as i64, &harmonics) != 0
    }

    pub fn get_days_in_year(calendar: &CalendarData, year: i32) -> i32 {
        let harmonics = calendar.get_harmonics();
        core::days_in_year(
            year as i64,
            calendar.get_base_days(),
            calendar.get_leap_offset(),
            &harmonics,
        ) as i32
    }

    pub fn get_absolute_minute(
        calendar: &CalendarData,
        era_index: usize,
        year: i32,
        month: i32,
        day: i32,
        hour: i32,
        minute: i32,
    ) -> i64 {
        let (mut h, mut m, mut e, mut d) =
            (Vec::new(), Vec::new(), Vec::new(), DialHierarchy::default());
        let config = calendar.to_core_config(&mut h, &mut m, &mut e, &mut d);
        let date = core::DateCoordinate {
            era_index,
            year: year as i64,
            month: month.max(0) as usize,
            day: day as i64,
            unit_values: vec![hour as i64, minute as i64],
        };
        core::date_to_t_abs(&date, &config)
    }

    pub fn get_date_from_absolute(
        absolute_minute: i64,
        calendar: &CalendarData,
        _era_index: usize,
    ) -> (i32, i32, i32, i32, i32) {
        let (mut h, mut m, mut e, mut d) =
            (Vec::new(), Vec::new(), Vec::new(), DialHierarchy::default());
        let config = calendar.to_core_config(&mut h, &mut m, &mut e, &mut d);
        let date = core::t_abs_to_date(absolute_minute, &config);
        (
            date.year as i32,
            date.month as i32,
            date.day as i32,
            date.unit_values.first().copied().unwrap_or(0) as i32,
            date.unit_values.get(1).copied().unwrap_or(0) as i32,
        )
    }

    pub fn get_anchor_offset(local_cal: &CalendarData, master_cal: Option<&CalendarData>) -> i64 {
        if local_cal.is_master.unwrap_or(false) {
            return 0;
        }
        let anchor = match &local_cal.sync_anchor {
            Some(a) if a.linked_to_master => a,
            _ => return 0,
        };
        if let (Some(loc), Some(mst), Some(mst_cal)) = (
            &anchor.local_anchor_date,
            &anchor.master_anchor_date,
            master_cal,
        ) {
            let l_min = Self::get_absolute_minute(
                local_cal, loc.era_index, loc.year, loc.month, loc.day, loc.hour, loc.minute,
            );
            let m_min = Self::get_absolute_minute(
                mst_cal, mst.era_index, mst.year, mst.month, mst.day, mst.hour, mst.minute,
            );
            return m_min - l_min;
        }
        anchor.master_absolute_minute - anchor.local_absolute_minute
    }

    pub fn local_to_master_minute(
        local_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        date: &DateCoordinate,
    ) -> i64 {
        Self::get_absolute_minute(
            local_cal, date.era_index, date.year, date.month, date.day, date.hour, date.minute,
        ) + Self::get_anchor_offset(local_cal, master_cal)
    }

    pub fn master_minute_to_local(
        master_minute: i64,
        local_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        era_index: usize,
    ) -> (i32, i32, i32, i32, i32) {
        let local_minute = master_minute - Self::get_anchor_offset(local_cal, master_cal);
        Self::get_date_from_absolute(local_minute, local_cal, era_index)
    }

    pub fn convert_between_calendars(
        from_cal: &CalendarData,
        to_cal: &CalendarData,
        master_cal: Option<&CalendarData>,
        date: &DateCoordinate,
        target_era_index: usize,
    ) -> (i32, i32, i32, i32, i32) {
        let master_min = Self::local_to_master_minute(from_cal, master_cal, date);
        Self::master_minute_to_local(master_min, to_cal, master_cal, target_era_index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::calendar::models::{
        CalendarData, CalendarMonth, CalendarSettings, SyncAnchor,
    };

    fn make_cal(is_master: bool, base_days: i32, leap_rule: &str) -> CalendarData {
        CalendarData {
            название: if is_master { "MasterCal" } else { "LocalCal" }.to_string(),
            calendar_type: None,
            is_master: Some(is_master),
            months: vec![CalendarMonth {
                название: "M1".to_string(),
                дней: base_days,
            }],
            eras: vec![],
            leap_year_rule: leap_rule.to_string(),
            custom_leap_rule: None,
            time_settings: Some(CalendarSettings::default()),
            moons: None,
            sync_anchor: None,
            planet_id: Some("earth".to_string()),
            ticks_per_day: None,
            day_start_offset: Some(0),
            retrograde: None,
            dial_hierarchy: None,
        }
    }

    #[test]
    fn calendar_math_positive_negative_and_conversion_use_case() {
        let no_leap = make_cal(true, 365, "none");
        assert!(!CalendarMath::is_leap_year(&no_leap, 2024));
        assert_eq!(CalendarMath::get_days_in_year(&no_leap, 2024), 365);

        let with_leap = make_cal(true, 365, "gregorian");
        assert!(CalendarMath::is_leap_year(&with_leap, 4));
        assert_eq!(CalendarMath::get_days_in_year(&with_leap, 4), 366);

        let abs = CalendarMath::get_absolute_minute(&with_leap, 0, 1, 0, 1, 2, 30);
        let (y, m, d, h, min) = CalendarMath::get_date_from_absolute(abs, &with_leap, 0);
        assert_eq!((y, m, d, h, min), (1, 0, 1, 2, 30));

        // Master / unlinked offset == 0
        assert_eq!(CalendarMath::get_anchor_offset(&with_leap, None), 0);
        let mut local = make_cal(false, 365, "none");
        assert_eq!(CalendarMath::get_anchor_offset(&local, Some(&with_leap)), 0);

        // Linked via raw absolute minutes
        local.sync_anchor = Some(SyncAnchor {
            master_calendar_id: Some("master".to_string()),
            linked_to_master: true,
            local_absolute_minute: 100,
            master_absolute_minute: 500,
            local_anchor_date: None,
            master_anchor_date: None,
        });
        assert_eq!(CalendarMath::get_anchor_offset(&local, Some(&with_leap)), 400);

        // Linked via anchor dates
        local.sync_anchor = Some(SyncAnchor {
            master_calendar_id: Some("master".to_string()),
            linked_to_master: true,
            local_absolute_minute: 0,
            master_absolute_minute: 0,
            local_anchor_date: Some(DateCoordinate {
                era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0,
            }),
            master_anchor_date: Some(DateCoordinate {
                era_index: 0, year: 1, month: 0, day: 2, hour: 0, minute: 0,
            }),
        });
        assert_eq!(CalendarMath::get_anchor_offset(&local, Some(&with_leap)), 1440);

        let converted = CalendarMath::convert_between_calendars(
            &local,
            &with_leap,
            Some(&with_leap),
            &DateCoordinate { era_index: 0, year: 1, month: 0, day: 1, hour: 3, minute: 15 },
            0,
        );
        assert_eq!(converted, (1, 0, 2, 3, 15));
    }
}
