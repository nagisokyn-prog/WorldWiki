//! Integration tests for fulltext & vector similarity search with surreal_domain.

mod common;

use common::{create_test_db, seed_project};
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
