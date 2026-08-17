//! Integration tests for Tauri commands generation via entity_commands! macro.

mod common;

use surreal_domain::{entity_commands, surreal_entity, surreal_relation, SurrealDb};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// Mock AppState matching what generated commands expect
pub struct AppState {
    pub db: Surreal<Db>,
}

impl SurrealDb for AppState {
    type Connection = Db;

    fn surreal_db(&self) -> &Surreal<Db> {
        &self.db
    }
}

surreal_entity! {
    #[table = "command_items"]
    #[tauri_commands]
    pub struct CommandItem {
        pub title: String,
        #[fulltext]
        pub description: Option<String>,
    }
}

surreal_relation! {
    #[edge = "linked_to"]
    #[tauri_commands]
    #[from = CommandItem]
    #[to = CommandItem]
    pub struct LinkedRelation {
        pub note: Option<String>,
    }
}

#[test]
fn test_entity_commands_syntax_compiles() {
    // Test that entity_commands! parses entities, searchable, and relations
    // and produces a valid handler macro invocation on mock runtime
    let _builder = tauri::test::mock_builder()
        .invoke_handler(entity_commands! {
            @entities: [CommandItem],
            @searchable: [CommandItem],
            @relations: [LinkedRelation]
        });
}
