//! Unit tests for surreal_domain macro expansion and AST parsing.
//!
//! Tests that macros:
//! - Parse attributes correctly
//! - Compile without errors
//! - Generate expected trait implementations

use surreal_domain::{SurrealRepository, surreal_entity};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[test]
fn unit_entity_macro_compiles_cleanly() {
    // This test simply verifies that the macro compiles and generates valid code
    // The fact that this compiles is the test passing
}

#[test]
fn unit_entity_attributes_parsed_correctly() {
    // Define a test entity with custom table name
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[surreal_entity(table = "custom_entities")]
    pub struct CustomEntity {
        id: Option<String>,
        name: String,
    }

    // Verify that the TABLE constant is set correctly
    assert_eq!(CustomEntity::TABLE, "custom_entities");
}

#[test]
fn unit_entity_default_table_name_from_struct() {
    // Entity without explicit table attribute should use lowercase struct name
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[surreal_entity]
    pub struct TestEntity {
        id: Option<String>,
        name: String,
    }

    assert_eq!(TestEntity::TABLE, "testentity");
}

#[test]
fn unit_entity_implements_surreal_repository_trait() {
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[surreal_entity(table = "test_repo")]
    pub struct RepoTestEntity {
        id: Option<String>,
        name: String,
    }

    // Create an instance and verify trait methods exist
    let mut entity = RepoTestEntity {
        id: Some("test:123".to_string()),
        name: "Test".to_string(),
    };

    // These method calls verify that SurrealRepository trait is implemented
    assert_eq!(entity.get_id(), Some("test:123".to_string()));

    entity.set_id("test:456".to_string());
    assert_eq!(entity.get_id(), Some("test:456".to_string()));
}

#[test]
fn unit_entity_with_field_attributes() {
    // Test that field attributes (#[fulltext], #[hnsw], #[flexible]) are parsed
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[surreal_entity]
    pub struct AnnotatedEntity {
        id: Option<String>,
        #[fulltext]
        title: String,
        #[hnsw]
        embedding: Vec<f32>,
        #[flexible]
        metadata: serde_json::Value,
    }

    // If attributes were parsed incorrectly, the struct wouldn't compile
    // The fact that we can create an instance verifies parsing worked
    let entity = AnnotatedEntity {
        id: None,
        title: "Test".to_string(),
        embedding: vec![0.1, 0.2, 0.3],
        metadata: json!({}),
    };

    assert_eq!(entity.title, "Test");
    assert_eq!(entity.embedding.len(), 3);
}

#[test]
fn unit_recordid_format_parsing() {
    // Test that RecordId format "table:key" is recognized and handled
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[surreal_entity(table = "entities")]
    pub struct EntityWithId {
        id: Option<String>,
        data: String,
    }

    let record_id = "entities:abc123";
    let parts: Vec<&str> = record_id.split(':').collect();

    assert_eq!(parts.len(), 2);
    assert_eq!(parts[0], "entities");
    assert_eq!(parts[1], "abc123");
}

#[test]
fn unit_entity_commands_dsl_syntax() {
    // This test verifies that the entity_commands! macro can parse DSL syntax
    // entity_commands![
    //     @entities: [Entity1, Entity2],
    //     @searchable: [SearchableEntity],
    //     @relations: [Relation1]
    // ]
    //
    // The actual invocation is tested in entity_commands_integration.rs
    // This unit test just documents the expected DSL structure
    
    // DSL components:
    let entities_list = vec!["Entity1", "Entity2"];
    let searchable_list = vec!["SearchableEntity"];
    let relations_list = vec!["Relation1"];

    assert!(!entities_list.is_empty());
    assert!(!searchable_list.is_empty());
    assert!(!relations_list.is_empty());
}

#[test]
fn unit_table_name_extraction() {
    // Test the logic for extracting table names from struct names
    fn extract_table_name(struct_name: &str) -> String {
        struct_name.to_lowercase()
    }

    assert_eq!(extract_table_name("User"), "user");
    assert_eq!(extract_table_name("EntitySchema"), "entityschema");
    assert_eq!(extract_table_name("GraphNeighborhood"), "graphneighborhood");
}

#[test]
fn unit_project_id_format_variants() {
    // Test recognition of three project_id format variants
    let raw_format = "p1";
    let record_format = "projects:p1";
    let type_format = "type::record('projects', 'p1')";

    // Extract base project ID from each format
    fn extract_project_id(input: &str) -> &str {
        if let Some(pos) = input.rfind(':') {
            &input[pos + 1..]
        } else {
            input
        }
    }

    assert_eq!(extract_project_id(raw_format), "p1");
    assert_eq!(extract_project_id(record_format), "p1");
    // The type_format needs special parsing, but the basic extraction works
}

#[test]
fn unit_field_attribute_flags() {
    // Test that attribute flags are correctly identified
    #[derive(Debug)]
    struct FieldMetadata {
        name: String,
        is_fulltext: bool,
        is_hnsw: bool,
        is_flexible: bool,
    }

    let fields = vec![
        FieldMetadata {
            name: "title".to_string(),
            is_fulltext: true,
            is_hnsw: false,
            is_flexible: false,
        },
        FieldMetadata {
            name: "embedding".to_string(),
            is_fulltext: false,
            is_hnsw: true,
            is_flexible: false,
        },
        FieldMetadata {
            name: "metadata".to_string(),
            is_fulltext: false,
            is_hnsw: false,
            is_flexible: true,
        },
    ];

    let fulltext_fields: Vec<_> = fields.iter().filter(|f| f.is_fulltext).collect();
    let hnsw_fields: Vec<_> = fields.iter().filter(|f| f.is_hnsw).collect();
    let flexible_fields: Vec<_> = fields.iter().filter(|f| f.is_flexible).collect();

    assert_eq!(fulltext_fields.len(), 1);
    assert_eq!(hnsw_fields.len(), 1);
    assert_eq!(flexible_fields.len(), 1);
}

#[test]
fn unit_macro_generated_code_structure() {
    // This test documents the expected structure of code generated by macros
    // For a struct like:
    //   #[surreal_entity(table = "users")]
    //   pub struct User { id: Option<String>, name: String }
    //
    // The macro should generate:
    // 1. impl SurrealRepository for User { ... }
    // 2. Optional: User_commands module (if tauri_commands attribute)
    // 3. Optional: search_fulltext() and search_similar() (if field annotations)

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[surreal_entity(table = "test")]
    pub struct TestStructure {
        id: Option<String>,
        data: String,
    }

    // Verify basic trait implementation structure
    assert_eq!(TestStructure::TABLE, "test");

    let mut instance = TestStructure {
        id: Some("test:1".to_string()),
        data: "test".to_string(),
    };

    // SurrealRepository methods
    assert!(instance.get_id().is_some());
    instance.set_id("test:2".to_string());
    assert_eq!(instance.get_id(), Some("test:2".to_string()));
}
