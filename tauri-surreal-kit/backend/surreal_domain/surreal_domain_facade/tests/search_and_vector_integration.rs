//! Integration tests for fulltext & vector similarity search with surreal_domain.

mod common;

use common::{create_test_db, seed_project};
#[cfg(feature = "full-db")]
use common::create_test_db_rocksdb;
use serde_json::json;
use surreal_domain::{
    surreal_entity, SearchKind, SearchResult, SimilarResult, SurrealRepository,
};

surreal_entity! {
    #[table = "lore_entries"]
    pub struct LoreEntry {
        pub title: String,
        #[fulltext]
        pub content: Option<String>,
        #[hnsw]
        pub embedding: Option<Vec<f32>>,
    }
}

#[tokio::test]
async fn test_search_result_dto_structure_and_kind() {
    let entry = LoreEntry {
        id: Some("lore_entries:1".into()),
        project_id: Some(json!("projects:p1")),
        title: "Ancient Ruins".into(),
        content: Some("Mysterious stones found in the valley".into()),
        embedding: Some(vec![0.1, 0.2, 0.3]),
    };

    let result = SearchResult {
        entity: entry.clone(),
        score: 0.95,
        kind: SearchKind::Fulltext,
    };

    assert_eq!(result.score, 0.95);
    match result.kind {
        SearchKind::Fulltext => (),
        _ => panic!("Expected Fulltext search kind"),
    }

    let sim_result = SimilarResult {
        entity: entry,
        similarity: 0.88,
    };

    assert_eq!(sim_result.similarity, 0.88);
}

#[tokio::test]
async fn test_search_fulltext_and_vector_methods_exist_on_macro_entity() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "World Alpha").await;


    // Настраиваем схему для полнотекстового и векторного поиска:
    // @@@ требует FULLTEXT индекс, <|$k, COSINE|> требует HNSW индекс
    let schema = r#"
DEFINE ANALYZER like TOKENIZERS blank, class, camel FILTERS ascii, lowercase;
DEFINE TABLE lore_entries SCHEMAFULL;
DEFINE FIELD project_id ON lore_entries TYPE option<record<projects>>;
DEFINE FIELD title ON lore_entries TYPE string;
DEFINE FIELD content ON lore_entries TYPE option<string>;
DEFINE FIELD embedding ON lore_entries TYPE option<array<float>>;
DEFINE INDEX idx_lore_content_ft ON lore_entries COLUMNS content FULLTEXT ANALYZER like BM25;
DEFINE INDEX idx_lore_embedding ON lore_entries COLUMNS embedding HNSW DIMENSION 3 DIST COSINE;
"#;
    db.query(schema).await.expect("Schema should apply");

    let entry = LoreEntry {
        id: None,
        project_id: Some(json!("projects:p1")),
        title: "Dragon Lore".into(),
        content: Some("Dragons sleep in deep volcanic caverns".into()),
        embedding: Some(vec![0.5, 0.5, 0.5]),
    };

    let created = LoreEntry::create(&db, entry)
        .await
        .expect("LoreEntry creation should succeed");
    assert!(created.id.is_some());

    // Calling search_fulltext generated method
    let ft_results = LoreEntry::search_fulltext(&db, "projects:p1", "volcanic")
        .await;
    assert!(ft_results.is_ok(), "search_fulltext should execute query without errors");

    // Calling search_similar generated method
    let vec_results = LoreEntry::search_similar(&db, vec![0.5, 0.5, 0.5], 5)
        .await;
    assert!(vec_results.is_ok(), "search_similar should execute query without errors");
}

#[test]
fn test_cosine_similarity_calculation() {
    fn cosine(a: &[f32], b: &[f32]) -> f32 {
        let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot / (norm_a * norm_b)
        }
    }

    let v1 = vec![1.0, 0.0, 0.0];
    let v2 = vec![1.0, 0.0, 0.0];
    assert!((cosine(&v1, &v2) - 1.0).abs() < 1e-5);

    let v3 = vec![0.0, 1.0, 0.0];
    assert!((cosine(&v1, &v3) - 0.0).abs() < 1e-5);
}

// ─── Functional Fulltext Search Tests (work on SurrealKv) ───

#[tokio::test]
async fn test_fulltext_search_returns_correct_results() {
    // Fulltext works on SurrealKv
    let db = create_test_db().await;
    seed_project(&db, "p1", "Test Project").await;

    // Setup schema with fulltext index
    let schema = r#"
    DEFINE ANALYZER like TOKENIZERS blank, class, camel FILTERS ascii, lowercase;
    DEFINE TABLE lore_entries SCHEMAFULL;
    DEFINE FIELD project_id ON lore_entries TYPE option<record<projects>>;
    DEFINE FIELD title ON lore_entries TYPE string;
    DEFINE FIELD content ON lore_entries TYPE option<string>;
    DEFINE INDEX idx_lore_content_ft ON lore_entries COLUMNS content FULLTEXT ANALYZER like BM25;
    "#;
    db.query(schema).await.expect("Schema apply");

    // Create 3 entries with different content
    let _e1 = LoreEntry::create(&db, LoreEntry { 
        id: None, 
        project_id: Some(json!("projects:p1")), 
        title: "Dragons".into(), 
        content: Some("Dragons sleep in volcanic caves".into()), 
        embedding: None 
    }).await.unwrap();
    
    let _e2 = LoreEntry::create(&db, LoreEntry { 
        id: None, 
        project_id: Some(json!("projects:p1")), 
        title: "Knights".into(), 
        content: Some("Knights fight dragons with swords".into()), 
        embedding: None 
    }).await.unwrap();
    
    let _e3 = LoreEntry::create(&db, LoreEntry { 
        id: None, 
        project_id: Some(json!("projects:p1")), 
        title: "Castles".into(), 
        content: Some("Castles are made of stone".into()), 
        embedding: None 
    }).await.unwrap();

    // Search for "dragons" - should match e1 and e2
    let results = LoreEntry::search_fulltext(&db, "projects:p1", "dragons").await.unwrap();
    assert_eq!(results.len(), 2, "Should find 2 entries containing 'dragons'");
    assert!(results.iter().any(|r| r.entity.title == "Dragons"), "Should find Dragons entry");
    assert!(results.iter().any(|r| r.entity.title == "Knights"), "Should find Knights entry");
    assert!(!results.iter().any(|r| r.entity.title == "Castles"), "Should NOT find Castles entry");

    // Search for "stone" - should match only e3
    let results = LoreEntry::search_fulltext(&db, "projects:p1", "stone").await.unwrap();
    assert_eq!(results.len(), 1, "Should find 1 entry containing 'stone'");
    assert_eq!(results[0].entity.title, "Castles");

    // Search for non-existent term
    let results = LoreEntry::search_fulltext(&db, "projects:p1", "unicorn").await.unwrap();
    assert_eq!(results.len(), 0, "Should find no entries for non-existent term");
}

// ─── Functional HNSW Vector Search Tests (require full-db feature + RocksDB) ───

#[cfg(feature = "full-db")]
#[tokio::test]
async fn test_hnsw_vector_search_returns_nearest_neighbors() {
    // Use RocksDB for HNSW support
    let db = create_test_db_rocksdb().await;
    seed_project(&db, "p1", "Test Project").await;

    // Schema with HNSW index
    let schema = r#"
    DEFINE TABLE lore_entries SCHEMAFULL;
    DEFINE FIELD project_id ON lore_entries TYPE option<record<projects>>;
    DEFINE FIELD title ON lore_entries TYPE string;
    DEFINE FIELD embedding ON lore_entries TYPE array<float>;
    DEFINE INDEX idx_lore_emb ON lore_entries COLUMNS embedding HNSW DIMENSION 3 DIST COSINE;
    "#;
    db.query(schema).await.expect("Schema apply");

    // Insert 3 orthogonal vectors
    let v1 = vec![1.0, 0.0, 0.0];  // X-axis
    let v2 = vec![0.0, 1.0, 0.0];  // Y-axis
    let v3 = vec![0.0, 0.0, 1.0];  // Z-axis

    LoreEntry::create(&db, LoreEntry { 
        id: None, 
        project_id: Some(json!("projects:p1")), 
        title: "X-axis".into(), 
        content: None, 
        embedding: Some(v1.clone()) 
    }).await.unwrap();

    LoreEntry::create(&db, LoreEntry { 
        id: None, 
        project_id: Some(json!("projects:p1")), 
        title: "Y-axis".into(), 
        content: None, 
        embedding: Some(v2.clone()) 
    }).await.unwrap();

    LoreEntry::create(&db, LoreEntry { 
        id: None, 
        project_id: Some(json!("projects:p1")), 
        title: "Z-axis".into(), 
        content: None, 
        embedding: Some(v3.clone()) 
    }).await.unwrap();

    // Query near X-axis (slightly perturbed)
    let query_vec = vec![0.99, 0.01, 0.0];
    let results = LoreEntry::search_similar(&db, query_vec, 2).await.unwrap();
    
    assert_eq!(results.len(), 2, "Should return 2 nearest neighbors");
    assert_eq!(results[0].entity.title, "X-axis", "Nearest should be X-axis");
    assert!(results[0].similarity > 0.95, "Similarity to X-axis should be > 0.95");
    assert_eq!(results[1].entity.title, "Y-axis", "Second nearest should be Y-axis");
    assert!(results[1].similarity < 0.1, "Similarity to Y-axis should be near 0");

    // Query with k=1
    let results = LoreEntry::search_similar(&db, vec![0.01, 0.99, 0.0], 1).await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].entity.title, "Y-axis");

    // Query Z-axis
    let results = LoreEntry::search_similar(&db, vec![0.0, 0.0, 1.0], 3).await.unwrap();
    assert_eq!(results.len(), 3);
    assert_eq!(results[0].entity.title, "Z-axis");
    assert!(results[0].similarity > 0.99, "Perfect match should have similarity ~1.0");
}
