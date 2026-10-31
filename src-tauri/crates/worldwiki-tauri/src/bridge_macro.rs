#[macro_export]
macro_rules! bridge_command {
    // 1. Асинхронная команда без аргументов
    (
        $cmd:ident () -> $ret:ty => $service:ident . $method:ident ()
    ) => {
        #[tauri::command]
        pub async fn $cmd(
            state: tauri::State<'_, $crate::state::AppState>,
        ) -> $ret {
            state
                .services
                .$service
                .$method()
                .await
                .map_err($crate::error::IpcError::from)
        }
    };

    // 2. Асинхронная команда с аргументами
    (
        $cmd:ident ( $( $param:ident : $param_ty:ty ),* $(,)? ) -> $ret:ty => $service:ident . $method:ident ( $( $arg:expr ),* $(,)? )
    ) => {
        #[tauri::command]
        pub async fn $cmd(
            state: tauri::State<'_, $crate::state::AppState>,
            $( $param : $param_ty , )*
        ) -> $ret {
            state
                .services
                .$service
                .$method( $( $arg ),* )
                .await
                .map_err($crate::error::IpcError::from)
        }
    };

    // 3. Синхронная команда с аргументами
    (
        sync $cmd:ident ( $( $param:ident : $param_ty:ty ),* $(,)? ) -> $ret:ty => $service:ident . $method:ident ( $( $arg:expr ),* $(,)? )
    ) => {
        #[tauri::command]
        pub fn $cmd(
            state: tauri::State<'_, $crate::state::AppState>,
            $( $param : $param_ty , )*
        ) -> $ret {
            state
                .services
                .$service
                .$method( $( $arg ),* )
                .map_err($crate::error::IpcError::from)
        }
    };

    // 4. Синхронная команда без аргументов
    (
        sync $cmd:ident () -> $ret:ty => $service:ident . $method:ident ()
    ) => {
        #[tauri::command]
        pub fn $cmd(
            state: tauri::State<'_, $crate::state::AppState>,
        ) -> $ret {
            state
                .services
                .$service
                .$method()
                .map_err($crate::error::IpcError::from)
        }
    };
}
