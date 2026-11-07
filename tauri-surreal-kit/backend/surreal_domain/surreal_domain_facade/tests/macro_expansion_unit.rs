//! Unit tests for surreal_domain macro expansion and AST parsing.
//!
//! Tests:
//! - surreal_entity! macro parsing and code generation
//! - Custom and default table name assignment
//! - Field attributes (fulltext, hnsw, flexible) handling
//! - surreal_relation! macro parsing with edge/from/to
//! - surreal_schema! validation macro

use surreal_domain::{surreal_entity, surreal_relation, surreal_schema, SurrealRepository};

// 1. Entity with custom table name
surreal_entity! {
    #[table = "custom_books"]
    pub struct CustomBook {
        pub title: String,
        pub pages: i32,
    }
}

// 2. Entity with default table name (inferred from struct name)
surreal_entity! {
    pub struct Author {
        pub name: String,
    }
}

// 3. Entity with search and vector attributes
surreal_entity! {
    #[table = "articles"]
    pub struct Article {
        pub title: String,
        #[fulltext]
        pub content: Option<String>,
        #[hnsw]
        pub embedding: Option<Vec<f32>>,
    }
}

// 4. Relation with edge and from/to attributes
surreal_relation! {
    #[edge = "wrote"]
    #[from = Author]
    #[to = CustomBook]
    pub struct WroteEdge {
        pub role: Option<String>,
    }
}

// 5. Relation with project_scoped and flexible attributes
surreal_relation! {
    #[project_scoped]
    pub struct TaggedRelation {
        #[flexible]
        pub custom_data: Option<serde_json::Value>,
    }
}

// Mock AppState matching what generated commands expect in crate root
pub struct AppState {
    pub db: surrealdb::Surreal<surrealdb::engine::local::Db>,
}

impl surreal_domain::SurrealDb for AppState {
    type Connection = surrealdb::engine::local::Db;

    fn surreal_db(&self) -> &surrealdb::Surreal<surrealdb::engine::local::Db> {
        &self.db
    }
}

// 6. Schema validation macro
surreal_schema! {
    entities: [CustomBook, Author, Article],
    relations: [WroteEdge, TaggedRelation]
}

// 7. Entity with vector search only (no fulltext) - covers entity_search.rs:53
surreal_entity! {
    #[table = "vector_only_items"]
    pub struct VectorOnlyItem {
        pub title: String,
        #[hnsw]
        pub embedding: Option<Vec<f32>>,
    }
}

// 8. Entity with tauri_commands but no fulltext - covers entity_tauri.rs:50
surreal_entity! {
    #[tauri_commands]
    #[table = "simple_commands"]
    pub struct SimpleCommandEntity {
        pub title: String,
        #[flexible]
        #[serde(skip_serializing_if = "Option::is_none")]
        pub explicit_skip: Option<serde_json::Value>,
        #[flexible]
        pub fallback_flex: std::collections::HashMap<String, String>,
    }
}

#[tauri::command]
fn my_custom_command() -> &'static str {
    "ok"
}

#[test]
fn unit_entity_commands_with_normal_command() {
    let _builder = tauri::test::mock_builder().invoke_handler(surreal_domain::entity_commands![
        my_custom_command,
        @entities: [SimpleCommandEntity]
    ]);
}

#[test]
fn unit_parse_entity_attributes_custom_table() {
    assert_eq!(CustomBook::TABLE, "custom_books");
}

#[test]
fn unit_parse_entity_default_table_name() {
    assert_eq!(Author::TABLE, "author");
}

#[test]
fn unit_entity_implements_surreal_repository_trait() {
    let mut book = CustomBook {
        id: None,
        project_id: None,
        title: "Dune".to_string(),
        pages: 412,
    };

    assert_eq!(book.get_id(), None);
    book.set_id("custom_books:1".to_string());
    assert_eq!(book.get_id(), Some("custom_books:1"));
}

#[test]
fn unit_relation_has_correct_table_and_methods() {
    assert_eq!(WroteEdge::TABLE, "wrote");

    let mut edge = WroteEdge {
        id: None,
        r#in: None,
        out: None,
        project_id: Some("projects:p1".to_string()),
        role: Some("Lead Author".to_string()),
    };

    assert_eq!(edge.id, None);
    edge.id = Some("wrote:e1".to_string());
    assert_eq!(edge.id, Some("wrote:e1".to_string()));
}
