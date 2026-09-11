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

use std::{env, fs};
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use tauri::Manager;

mod logic;

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

async fn init_database(
    ns: &str, // e.g. "my_app"
    db: &str, // e.g. "my_app"
              // Optionally pass a DDL schema string:
              // schema_sql: Option<&str>,
) -> Surreal<Db> {
    let db_path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("surreal_db");
    fs::create_dir_all(&db_path).ok();

    let conn = Surreal::new::<SurrealKv>(db_path)
        .await
        .expect("Failed to start SurrealDB");
    conn.use_ns(ns)
        .use_db(db)
        .await
        .expect("Failed to use NS/DB");

    // ── Apply DDL schema if you have one ──────────────────────────────────
    // Uncomment and customise:
    //
    // let sql = include_str!("../../src/logic/your_schema.surql");
    // match conn.query(sql).await {
    //     Ok(mut res) => {
    //         if let Some(err) = res.take_errors().into_iter().next() {
    //             eprintln!("DDL Error: {:?}", err);
    //         } else {
    //             println!("DDL Schema applied successfully.");
    //         }
    //     }
    //     Err(e) => eprintln!("Failed to execute DDL: {:?}", e),
    // }

    conn
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    use logic::system::*;

    tauri::Builder::<tauri::test::MockRuntime>::default()
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
            // Example:
            //   get_projects, create_project, delete_project,
            //   get_entities, save_entity, delete_entity,
            //   @entities:  [Chapter, Volume, Tag],
            //   @searchable: [TextBlock],
            //   @relations:  [Cites],
        ])
        .setup(|app| {
            // Change "my_app" to your own namespace / database name.
            let db = tauri::async_runtime::block_on(init_database("my_app", "my_app"));
            app.manage(AppState { db });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
