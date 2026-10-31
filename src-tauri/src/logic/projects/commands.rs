//! IPC layer for module `projects`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use crate::forward_ipc;
use serde_json::Value;

forward_ipc!(
    get_projects() -> Result<Vec<Value>, ProjectError>
        => get_projects_inner()
);

forward_ipc!(
    create_project(project_data: Value) -> Result<String, ProjectError>
        => create_project_inner(project_data)
);

forward_ipc!(
    get_project_config(name: String) -> Result<Value, ProjectError>
        => get_project_config_inner(&name)
);

forward_ipc!(
    save_project_config(name: String, config: Value) -> Result<Value, ProjectError>
        => save_project_config_inner(&name, config)
);

forward_ipc!(
    delete_project(name: String) -> Result<String, ProjectError>
        => delete_project_inner(&name)
);

forward_ipc!(
    execute_raw_surql(query: String) -> Result<Value, ProjectError>
        => execute_raw_surql_inner(&query)
);
