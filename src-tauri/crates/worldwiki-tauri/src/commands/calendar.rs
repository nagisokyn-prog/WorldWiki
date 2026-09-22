use tauri::State;
use worldwiki_application::calendar::ConvertCalendarDateParams;
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

#[tauri::command]
pub fn convert_calendar_date(
    state: State<'_, AppState>,
    params: ConvertCalendarDateParams,
) -> Result<serde_json::Value, IpcError> {
    state
        .services
        .calendar
        .convert_calendar_date(&params)
        .map_err(IpcError::from)
}
