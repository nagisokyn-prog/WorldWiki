//! IPC layer for module `connections`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use crate::forward_ipc;
use serde_json::Value;

forward_ipc!(
    get_connections(project: String, chapter: Option<String>) -> Result<Value, ConnectionError>
        => get_connections_inner(&project, chapter)
);

forward_ipc!(
    save_connections(project: String, source_id: String, data: Value) -> Result<(), ConnectionError>
        => save_connections_inner(&project, &source_id, data)
);

forward_ipc!(
    remove_connections_by_source(project: String, e_type: String, e_id: String) -> Result<usize, ConnectionError>
        => remove_connections_by_source_inner(&project, &e_type, &e_id)
);
