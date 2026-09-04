use tauri::State;
use worldwiki_domain::calendar::CalendarData;
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub fn convert_absolute_to_local(
    state: State<'_, AppState>,
    absolute_minute: i64,
    calendar: CalendarData,
    era_index: usize,
) -> Result<serde_json::Value, IpcError> {
    state
        .services
        .calendar
        .convert_absolute_to_local(absolute_minute, &calendar, era_index)
        .map_err(IpcError::from)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn convert_calendar_date(
    state: State<'_, AppState>,
    from_calendar: CalendarData,
    to_calendar: CalendarData,
    master_calendar: Option<CalendarData>,
    era_index: usize,
    year: i32,
    month: i32,
    day: i32,
    hour: i32,
    minute: i32,
    target_era_index: Option<usize>,
) -> Result<serde_json::Value, IpcError> {
    state
        .services
        .calendar
        .convert_calendar_date(
            &from_calendar,
            &to_calendar,
            master_calendar.as_ref(),
            era_index,
            year,
            month,
            day,
            hour,
            minute,
            target_era_index,
        )
        .map_err(IpcError::from)
}
