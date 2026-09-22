use super::absolute::{get_absolute_minute, get_date_from_absolute};
use crate::calendar::models::{CalendarData, DateCoordinate};

pub fn get_anchor_offset(local_cal: &CalendarData, master_cal: Option<&CalendarData>) -> i64 {
    if local_cal.is_master.unwrap_or(false) {
        return 0;
    }
    if let Some(anchor) = &local_cal.sync_anchor {
        if !anchor.linked_to_master {
            return 0;
        }
        if let (Some(loc_date), Some(mst_date), Some(mst_cal)) = (
            &anchor.local_anchor_date,
            &anchor.master_anchor_date,
            master_cal,
        ) {
            let local_min = get_absolute_minute(
                local_cal,
                loc_date.era_index,
                loc_date.year,
                loc_date.month,
                loc_date.day,
                loc_date.hour,
                loc_date.minute,
            );
            let master_min = get_absolute_minute(
                mst_cal,
                mst_date.era_index,
                mst_date.year,
                mst_date.month,
                mst_date.day,
                mst_date.hour,
                mst_date.minute,
            );
            return master_min - local_min;
        }
        if anchor.master_absolute_minute != 0 || anchor.local_absolute_minute != 0 {
            return anchor.master_absolute_minute - anchor.local_absolute_minute;
        }
    }
    0
}

pub fn local_to_master_minute(
    local_cal: &CalendarData,
    master_cal: Option<&CalendarData>,
    date: &DateCoordinate,
) -> i64 {
    let local_min = get_absolute_minute(
        local_cal,
        date.era_index,
        date.year,
        date.month,
        date.day,
        date.hour,
        date.minute,
    );
    let offset = get_anchor_offset(local_cal, master_cal);
    local_min + offset
}

pub fn master_minute_to_local(
    master_minute: i64,
    local_cal: &CalendarData,
    master_cal: Option<&CalendarData>,
    era_index: usize,
) -> (i32, i32, i32, i32, i32) {
    let offset = get_anchor_offset(local_cal, master_cal);
    let local_min = master_minute - offset;
    get_date_from_absolute(local_min, local_cal, era_index)
}

pub fn convert_between_calendars(
    from_cal: &CalendarData,
    to_cal: &CalendarData,
    master_cal: Option<&CalendarData>,
    from_date: &DateCoordinate,
    to_era: usize,
) -> (i32, i32, i32, i32, i32) {
    let master_min = local_to_master_minute(from_cal, master_cal, from_date);
    master_minute_to_local(master_min, to_cal, master_cal, to_era)
}
