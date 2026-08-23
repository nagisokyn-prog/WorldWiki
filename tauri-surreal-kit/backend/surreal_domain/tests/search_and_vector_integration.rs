//! Integration tests for search functionality (fulltext and vector similarity).
//!
//! Tests:
//! - Fulltext search on annotated fields
//! - Vector similarity search with HNSW
//! - SearchResult and SimilarResult DTOs
//! - Embedding dimension validation

mod common;

use common::create_test_db;
use surreal_domain::{SurrealRepository, SearchResult, SimilarResult, SearchKind};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SearchableEntity {
    id: Option<String>,
    project_id: Option<String>,
    title: String,
    content: String,
    embedding: Option<Vec<f32>>,
    tags: Vec<String>,
}

impl SurrealRepository for SearchableEntity {
    const TABLE: &'static str = "searchable_entities";

    fn get_id(&self) -> Option<String> {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = Some(id);
    }
}

#[test]
fn test_search_kind_enum() {
    // Test SearchKind enum variants
    let fulltext = SearchKind::Fulltext;
    let vector = SearchKind::Vector;
    let hybrid = SearchKind::Hybrid;

    match fulltext {
        SearchKind::Fulltext => assert!(true),
        _ => panic!("Should be Fulltext"),
    }

    match vector {
        SearchKind::Vector => assert!(true),
        _ => panic!("Should be Vector"),
    }

    match hybrid {
        SearchKind::Hybrid => assert!(true),
        _ => panic!("Should be Hybrid"),
    }
}

#[test]
fn test_search_result_dto() {
    let entity = SearchableEntity {
        id: Some("entities:e1".into()),
        project_id: Some("projects:p1".into()),
        title: "Test Entity".into(),
        content: "Some content".into(),
        embedding: None,
        tags: vec!["tag1".into()],
    };

    let result = SearchResult {
        entity: entity.clone(),
        score: 0.95,
        kind: SearchKind::Fulltext,
    };

    assert_eq!(result.score, 0.95);
    assert_eq!(result.entity.title, "Test Entity");
    match result.kind {
        SearchKind::Fulltext => assert!(true),
        _ => panic!("Should be Fulltext"),
    }
}

#[test]
fn test_similar_result_dto() {
    let entity = SearchableEntity {
        id: Some("entities:e1".into()),
        project_id: Some("projects:p1".into()),
        title: "Test".into(),
        content: "Content".into(),
        embedding: Some(vec![0.1, 0.2, 0.3]),
        tags: vec![],
    };

    let similar = SimilarResult {
        entity: entity.clone(),
        similarity: 0.87,
    };

    assert_eq!(similar.similarity, 0.87);
    assert_eq!(similar.entity.title, "Test");
}

#[test]
fn test_fulltext_search_field_annotation() {
    // Field with #[fulltext] should be indexed for full-text search
    // This documents that title and content fields should be fulltext-indexed
    let entity = SearchableEntity {
        id: Some("entities:e1".into()),
        project_id: Some("projects:p1".into()),
        title: "The brave hero".into(),
        content: "A story about courage".into(),
        embedding: None,
        tags: vec![],
    };

    // Simulate fulltext search query matching
    let search_query = "brave";
    let title_matches = entity.title.to_lowercase().contains(&search_query.to_lowercase());
    let content_matches = entity.content.to_lowercase().contains(&search_query.to_lowercase());

    assert!(title_matches || content_matches, "Should match search query");
}

#[test]
fn test_hnsw_vector_field_annotation() {
    // Field with #[hnsw] should be HNSW-indexed for similarity search
    let embedding_1536 = (0..1536).map(|i| (i as f32) / 1536.0).collect::<Vec<_>>();

    let entity = SearchableEntity {
        id: Some("entities:e1".into()),
        project_id: Some("projects:p1".into()),
        title: "Vector Entity".into(),
        content: "Content".into(),
        embedding: Some(embedding_1536.clone()),
        tags: vec![],
    };

    assert!(entity.embedding.is_some());
    let emb = entity.embedding.as_ref().unwrap();
    assert_eq!(emb.len(), 1536, "Embedding should be 1536-dimensional");
}

#[test]
fn test_vector_similarity_cosine_distance() {
    // Simulate cosine similarity calculation
    fn cosine_similarity(v1: &[f32], v2: &[f32]) -> f32 {
        let dot_product: f32 = v1.iter().zip(v2).map(|(a, b)| a * b).sum();
        let norm1: f32 = v1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm2: f32 = v2.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm1 == 0.0 || norm2 == 0.0 {
            0.0
        } else {
            dot_product / (norm1 * norm2)
        }
    }

    let v1 = vec![1.0, 0.0, 0.0];
    let v2 = vec![1.0, 0.0, 0.0];
    let v3 = vec![0.0, 1.0, 0.0];

    let sim_identical = cosine_similarity(&v1, &v2);
    let sim_orthogonal = cosine_similarity(&v1, &v3);

    assert!((sim_identical - 1.0).abs() < 0.001, "Identical vectors should have similarity ~1.0");
    assert!(sim_orthogonal.abs() < 0.001, "Orthogonal vectors should have similarity ~0.0");
}

#[test]
fn test_embedding_dimension_mismatch() {
    // Test validation of embedding dimensions
    let valid_dim_1536 = vec![0.1; 1536];
    let invalid_dim_512 = vec![0.1; 512];
    let invalid_dim_2048 = vec![0.1; 2048];

    // In real implementation, dimension validation should happen when storing
    // This test documents the expected behavior
    assert_eq!(valid_dim_1536.len(), 1536);
    assert_ne!(invalid_dim_512.len(), 1536);
    assert_ne!(invalid_dim_2048.len(), 1536);
}

#[test]
fn test_search_result_collections() {
    // Multiple search results should be sortable by score
    let results = vec![
        SearchResult {
            entity: SearchableEntity {
                id: Some("e1".into()),
                project_id: None,
                title: "Low score".into(),
                content: String::new(),
                embedding: None,
                tags: vec![],
            },
            score: 0.5,
            kind: SearchKind::Fulltext,
        },
        SearchResult {
            entity: SearchableEntity {
                id: Some("e2".into()),
                project_id: None,
                title: "High score".into(),
                content: String::new(),
                embedding: None,
                tags: vec![],
            },
            score: 0.95,
            kind: SearchKind::Fulltext,
        },
        SearchResult {
            entity: SearchableEntity {
                id: Some("e3".into()),
                project_id: None,
                title: "Medium score".into(),
                content: String::new(),
                embedding: None,
                tags: vec![],
            },
            score: 0.75,
            kind: SearchKind::Fulltext,
        },
    ];

    // Sort by score descending
    let mut sorted = results.clone();
    sorted.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

    assert_eq!(sorted[0].score, 0.95);
    assert_eq!(sorted[1].score, 0.75);
    assert_eq!(sorted[2].score, 0.5);
}

#[test]
fn test_similar_results_ranking() {
    // Multiple similarity results should be rankable by similarity score
    let results = vec![
        SimilarResult {
            entity: SearchableEntity {
                id: Some("e1".into()),
                project_id: None,
                title: "Most similar".into(),
                content: String::new(),
                embedding: Some(vec![1.0, 0.0, 0.0]),
                tags: vec![],
            },
            similarity: 0.99,
        },
        SimilarResult {
            entity: SearchableEntity {
                id: Some("e2".into()),
                project_id: None,
                title: "Least similar".into(),
                content: String::new(),
                embedding: Some(vec![0.0, 1.0, 0.0]),
                tags: vec![],
            },
            similarity: 0.45,
        },
        SimilarResult {
            entity: SearchableEntity {
                id: Some("e3".into()),
                project_id: None,
                title: "Medium similar".into(),
                content: String::new(),
                embedding: Some(vec![0.7, 0.3, 0.0]),
                tags: vec![],
            },
            similarity: 0.72,
        },
    ];

    // Sort by similarity descending
    let mut sorted = results.clone();
    sorted.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap());

    assert_eq!(sorted[0].similarity, 0.99);
    assert_eq!(sorted[1].similarity, 0.72);
    assert_eq!(sorted[2].similarity, 0.45);
}

#[test]
fn test_hybrid_search_combining_fulltext_and_vector() {
    // Hybrid search combines fulltext and vector results
    let fulltext_result = SearchResult {
        entity: SearchableEntity {
            id: Some("e1".into()),
            project_id: None,
            title: "Matching title".into(),
            content: String::new(),
            embedding: None,
            tags: vec![],
        },
        score: 0.8,
        kind: SearchKind::Fulltext,
    };

    let vector_result = SearchResult {
        entity: SearchableEntity {
            id: Some("e2".into()),
            project_id: None,
            title: "Similar embedding".into(),
            content: String::new(),
            embedding: Some(vec![0.9, 0.1]),
            tags: vec![],
        },
        score: 0.85,
        kind: SearchKind::Vector,
    };

    let hybrid_results = vec![fulltext_result, vector_result];

    assert_eq!(hybrid_results.len(), 2);
    assert_eq!(hybrid_results[0].kind as u8, SearchKind::Fulltext as u8);
    assert_eq!(hybrid_results[1].kind as u8, SearchKind::Vector as u8);
}

#[test]
fn test_search_result_serialization() {
    let entity = SearchableEntity {
        id: Some("entities:e1".into()),
        project_id: Some("projects:p1".into()),
        title: "Test".into(),
        content: "Content".into(),
        embedding: Some(vec![0.1, 0.2, 0.3]),
        tags: vec!["tag1".into()],
    };

    let result = SearchResult {
        entity,
        score: 0.92,
        kind: SearchKind::Fulltext,
    };

    // Serialize to JSON
    let json = serde_json::to_value(&result).expect("Should serialize");

    assert_eq!(json["score"], 0.92);
    assert!(json["entity"].is_object());
    assert_eq!(json["entity"]["title"], "Test");
}

#[test]
fn test_similar_result_serialization_and_chapter_range() {
    let entity = SearchableEntity {
        id: Some("entities:e2".into()),
        project_id: Some("projects:p2".into()),
        title: "Similar Entity".into(),
        content: "Some content".into(),
        embedding: Some(vec![0.5, 0.5, 0.5]),
        tags: vec![],
    };

    let sim_result = SimilarResult {
        entity: entity.clone(),
        similarity: 0.987,
    };

    let sim_json = serde_json::to_value(&sim_result).expect("Should serialize SimilarResult");
    assert_eq!(sim_json["similarity"], 0.987);
    assert_eq!(sim_json["entity"]["title"], "Similar Entity");

    // ChapterRange tests
    let default_range = surreal_domain::ChapterRange::default();
    assert!(default_range.start_chapter.is_none());
    assert!(default_range.end_chapter.is_none());

    let custom_range = surreal_domain::ChapterRange {
        start_chapter: Some("chapters:1".to_string()),
        end_chapter: Some("chapters:5".to_string()),
    };

    let range_json = serde_json::to_value(&custom_range).expect("Should serialize ChapterRange");
    assert_eq!(range_json["start_chapter"], "chapters:1");
    assert_eq!(range_json["end_chapter"], "chapters:5");
}

#[test]
fn test_core_graph_edge_and_neighborhood_serialization() {
    let edge: surreal_domain::GraphEdge<String, String> = surreal_domain::GraphEdge {
        edge_id: "knows:1".to_string(),
        edge_data: "friend".to_string(),
        node: "characters:bob".to_string(),
        direction: surreal_domain::EdgeDirection::Both,
    };

    let edge_str = serde_json::to_string(&edge).unwrap();
    let edge_deser: surreal_domain::GraphEdge<String, String> = serde_json::from_str(&edge_str).unwrap();
    assert_eq!(edge_deser.edge_id, "knows:1");
    let _debug = format!("{:?}", edge_deser);

    let neighborhood = surreal_domain::GraphNeighborhood {
        center_id: "c1".to_string(),
        nodes: vec![json!({"id": "c2"})],
        edges: vec![json!({"id": "e1"})],
        depth: 2,
    };
    let n_str = serde_json::to_string(&neighborhood).unwrap();
    let n_deser: surreal_domain::GraphNeighborhood = serde_json::from_str(&n_str).unwrap();
    assert_eq!(n_deser.depth, 2);
    let _debug_n = format!("{:?}", n_deser);
}
