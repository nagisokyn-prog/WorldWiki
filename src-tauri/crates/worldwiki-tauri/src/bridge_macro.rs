#[macro_export]
macro_rules! bridge_command {
    ($cmd_name:ident, $service_group:ident, $method:ident, ($($arg:ident: $arg_type:ty),*)) => {
        #[tauri::command]
        pub async fn $cmd_name(
            state: tauri::State<'_, $crate::state::AppState>,
            $($arg: $arg_type),*
        ) -> Result<impl serde::Serialize, $crate::error::IpcError> {
            state.services.$service_group.$method($($arg),*).await
                .map_err($crate::error::IpcError::from)
        }
    };
}
