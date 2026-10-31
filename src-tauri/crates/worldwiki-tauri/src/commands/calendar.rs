use worldwiki_application::calendar::ConvertCalendarDateParams;
use worldwiki_domain::calendar::CalendarData;
use crate::error::IpcError;
use crate::bridge_command;

bridge_command!(
    sync convert_absolute_to_local(
        absolute_minute: i64,
        calendar: CalendarData,
        era_index: usize,
    ) -> Result<serde_json::Value, IpcError>
        => calendar.convert_absolute_to_local(absolute_minute, &calendar, era_index)
);

bridge_command!(
    sync convert_calendar_date(params: ConvertCalendarDateParams) -> Result<serde_json::Value, IpcError>
        => calendar.convert_calendar_date(&params)
);
