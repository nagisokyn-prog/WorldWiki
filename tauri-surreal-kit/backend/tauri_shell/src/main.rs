// tauri-surreal-kit / tauri_shell / src/main.rs
//
// ─────────────────────────────────────────────────────────────────────────────
// Domain-agnostic Tauri + SurrealDB bootstrap template.
//
// HOW TO USE IN YOUR APP:
//   1. Copy / depend on this crate.
//   2. Add your domain models in a `logic/models.rs` file.
//   3. Register them via `entity_commands![ @entities: [...], @relations: [...] ]`
//   4. Replace "my_app" with your namespace/database name below.
// ─────────────────────────────────────────────────────────────────────────────
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(any(test, feature = "wry"))]
use std::fs;
use surrealdb::engine::local::Db;
#[cfg(any(test, feature = "wry"))]
use surrealdb::engine::local::SurrealKv;
use surrealdb::Surreal;
#[cfg(any(test, feature = "wry"))]
use tauri::Manager;

#[cfg(any(test, feature = "wry"))]
use tauri_shell::logic;

// ─── App State ───────────────────────────────────────────────────────────────

pub struct AppState {
    pub db: Surreal<Db>,
}

/// Connects the framework's generic CRUD macros to AppState.
/// Required by all surreal_domain-generated commands.
impl surreal_domain::SurrealDb for AppState {
    type Connection = Db;
    fn surreal_db(&self) -> &Surreal<Db> {
        &self.db
    }
}

// ─── Database Init ────────────────────────────────────────────────────────────

#[cfg(any(test, feature = "wry"))]
async fn init_database(
    ns: &str, // e.g. "my_app"
    db: &str, // e.g. "my_app"
) -> Result<Surreal<Db>, Box<dyn std::error::Error>> {
    let db_path = logic::system_core::get_data_dir().join("surreal_db");
    fs::create_dir_all(&db_path)?;

    let conn = Surreal::new::<SurrealKv>(db_path).await?;
    conn.use_ns(ns).use_db(db).await?;
    Ok(conn)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

#[cfg(any(test, feature = "wry"))]
pub fn setup_app<R: tauri::Runtime>(app: &mut tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let db = tauri::async_runtime::block_on(init_database("my_app", "my_app"))?;
    app.manage(AppState { db });
    Ok(())
}

#[cfg(any(test, feature = "wry"))]
pub fn configure_app<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    use logic::system::*;

    builder
        .invoke_handler(surreal_domain::entity_commands![
            // ── System commands (always included) ──────────────────────────
            upload_photo,
            copy_background_file,
            get_local_file,
            run_performance_benchmark,
            get_performance_styles,
            save_settings,
            load_settings,
            toggle_fullscreen,
            get_custom_themes,
            load_theme,
            save_custom_theme,
            // ── ADD YOUR DOMAIN COMMANDS HERE ─────────────────────────────
        ])
        .setup(setup_app)
}

#[cfg(test)]
pub fn build_app() -> tauri::Builder<tauri::test::MockRuntime> {
    configure_app(tauri::Builder::<tauri::test::MockRuntime>::default())
}

#[cfg(all(not(test), feature = "wry"))]
fn main() {
    if let Err(e) = configure_app(tauri::Builder::<tauri::Wry>::default()).run(tauri::generate_context!()) {
        eprintln!("error while running tauri application: {:?}", e);
        std::process::exit(1);
    }
}

#[cfg(all(not(test), not(feature = "wry")))]
fn main() {}

#[cfg(test)]
mod tests {
    use super::*;
    use surreal_domain::SurrealDb;

    #[tokio::test]
    async fn test_app_state_and_surreal_db() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let kv_db = Surreal::new::<SurrealKv>(temp.path().join("db")).await.expect("create kv db");
        kv_db.use_ns("test").use_db("test").await.expect("use ns/db");
        let state = AppState { db: kv_db };
        let retrieved = state.surreal_db();
        assert!(retrieved.health().await.is_ok());
    }

    #[tokio::test]
    async fn test_init_database() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let data_dir = temp.path().join("data");
        std::fs::create_dir_all(&data_dir).expect("create data dir");
        tauri_shell::logic::system_core::set_data_dir_provider(Box::new(TestProvider(data_dir)));

        let db = init_database("test_ns", "test_db").await.expect("init db");
        assert!(db.health().await.is_ok());

        tauri_shell::logic::system_core::clear_data_dir_provider();
    }

    #[test]
    fn test_init_database_error() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let data_dir = temp.path().join("data");
        std::fs::create_dir_all(&data_dir).expect("create data dir");
        // create surreal_db as a file so create_dir_all fails
        std::fs::write(data_dir.join("surreal_db"), b"blocking file").expect("write file");
        tauri_shell::logic::system_core::set_data_dir_provider(Box::new(TestProvider(data_dir)));

        let err = tauri::async_runtime::block_on(init_database("test_ns", "test_db"));
        assert!(err.is_err());

        let builder = build_app();
        let mut app = builder
            .build(tauri::generate_context!())
            .expect("build mock app");
        let setup_err = setup_app(&mut app);
        assert!(setup_err.is_err());

        tauri_shell::logic::system_core::clear_data_dir_provider();
    }

    #[test]
    fn test_build_app_setup_and_handlers() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let data_dir = temp.path().join("data");
        std::fs::create_dir_all(&data_dir).expect("create data dir");
        tauri_shell::logic::system_core::set_data_dir_provider(Box::new(TestProvider(data_dir)));

        let builder = build_app();
        let mut app = builder
            .build(tauri::generate_context!())
            .expect("build mock app");

        setup_app(&mut app).expect("setup app");
        let retrieved = app.state::<AppState>();
        let health = tauri::async_runtime::block_on(async {
            retrieved.inner().surreal_db().health().await
        });
        assert!(health.is_ok());

        tauri_shell::logic::system_core::clear_data_dir_provider();
    }

    #[derive(Debug)]
    struct TestProvider(std::path::PathBuf);
    impl tauri_shell::logic::system_core::DataDirProvider for TestProvider {
        fn get_data_dir(&self) -> std::path::PathBuf {
            self.0.clone()
        }
    }
}
