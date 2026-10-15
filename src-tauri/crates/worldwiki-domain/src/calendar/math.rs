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
