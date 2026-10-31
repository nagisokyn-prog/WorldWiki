pub mod batch;
pub mod chapters;
pub mod connections;
pub mod entities;
pub mod models;
pub mod projects;
pub mod schema;
pub mod volumes;

/// Макрос для повтора асинхронных операций SurrealDB при конфликтах OCC (Transaction write conflict).
#[macro_export]
macro_rules! with_occ_retry {
    ($attempts:expr, $delay_ms:expr, $op:expr) => {{
        let mut count = 0;
        loop {
            count += 1;
            match $op.await {
                Ok(val) => break Ok(val),
                Err(err) => {
                    let err_str = err.to_string();
                    if (err_str.contains("Transaction conflict") || err_str.contains("write conflict"))
                        && count < $attempts
                    {
                        tokio::time::sleep(tokio::time::Duration::from_millis($delay_ms * count)).await;
                        continue;
                    }
                    break Err(err);
                }
            }
        }
    }};
}

/// Генерирует типовую Tauri IPC команду с внедрением State и делегированием в функцию ядра `_inner`.
/// Предназначен строго для типовых чистых прокси.
#[macro_export]
macro_rules! forward_ipc {
    (
        $cmd:ident () -> Result<$ret:ty, $err:ty> => $inner:ident ()
    ) => {
        #[tauri::command]
        pub async fn $cmd(
            state: tauri::State<'_, $crate::AppState>,
        ) -> Result<$ret, $err> {
            $inner(&state.db).await
        }
    };

    (
        $cmd:ident ( $( $param:ident : $param_ty:ty ),* $(,)? ) -> Result<$ret:ty, $err:ty> => $inner:ident ( $( $arg:expr ),* $(,)? )
    ) => {
        #[tauri::command]
        pub async fn $cmd(
            $( $param : $param_ty , )*
            state: tauri::State<'_, $crate::AppState>,
        ) -> Result<$ret, $err> {
            $inner(&state.db, $( $arg ),* ).await
        }
    };
}

pub mod calendar_math {
    pub use worldwiki_domain::calendar::*;
}

pub mod documents {
    pub use worldwiki_infrastructure::documents::*;
}

pub mod export {
    pub use worldwiki_infrastructure::storage::*;
}

pub mod ai {
    pub use worldwiki_infrastructure::ai::*;
    pub use worldwiki_application::ai::*;
}
