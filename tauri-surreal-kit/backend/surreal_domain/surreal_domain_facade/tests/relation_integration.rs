//! Integration tests for graph relations using surreal_relation! macro and SurrealDB.

mod common;

use common::{create_test_db, seed_project};
use serde_json::json;
use surreal_domain::{
    surreal_entity, surreal_relation, EdgeDirection, GraphEdge, GraphNeighborhood,
    SurrealRepository,
};

surreal_entity! {
    #[table = "characters"]
    pub struct CharacterNode {
        pub name: String,
    }
}

surreal_relation! {
    #[edge = "knows"]
    #[from = CharacterNode]
    #[to = CharacterNode]
    pub struct KnowsEdge {
        pub relationship_type: String,
        pub affinity: i32,
    }
}

#[tokio::test]
async fn test_relation_relate_creates_edge_with_content() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let c1 = CharacterNode::create(
        &db,
        CharacterNode {
            id: None,
            project_id: Some(json!("projects:p1")),
            name: "Alice".into(),
        },
    )
    .await
    .expect("Alice creation failed");

    let c2 = CharacterNode::create(
        &db,
        CharacterNode {
            id: None,
            project_id: Some(json!("projects:p1")),
            name: "Bob".into(),
        },
    )
    .await
    .expect("Bob creation failed");

    let c1_id = c1.id.unwrap();
    let c2_id = c2.id.unwrap();

    let edge_data = KnowsEdge {
        id: None,
        r#in: None,
        out: None,
        project_id: Some("projects:p1".into()),
        relationship_type: "Allies".into(),
        affinity: 80,
    };

    let edge_id = KnowsEdge::relate(&db, &c1_id, &c2_id, edge_data)
        .await
        .expect("relate should succeed");

    assert!(!edge_id.is_empty(), "Edge ID must not be empty");
}

#[tokio::test]
async fn test_relation_delete_removes_edge() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let c1 = CharacterNode::create(
        &db,
        CharacterNode {
            id: None,
            project_id: Some(json!("projects:p1")),
            name: "Alice".into(),
        },
    )
    .await
    .unwrap();

    let c2 = CharacterNode::create(
        &db,
        CharacterNode {
            id: None,
            project_id: Some(json!("projects:p1")),
            name: "Bob".into(),
        },
    )
    .await
    .unwrap();

    let edge_data = KnowsEdge {
        id: None,
        r#in: None,
        out: None,
        project_id: Some("projects:p1".into()),
        relationship_type: "Rivals".into(),
        affinity: -20,
    };

    let edge_id = KnowsEdge::relate(&db, c1.id.as_ref().unwrap(), c2.id.as_ref().unwrap(), edge_data)
        .await
        .expect("relate should succeed");

    // Delete relation
    KnowsEdge::delete(&db, &edge_id)
        .await
        .expect("delete relation should succeed");
}

#[test]
fn test_graph_neighborhood_structure_serialization() {
    let neighborhood = GraphNeighborhood {
        center_id: "characters:alice".to_string(),
        nodes: vec![serde_json::json!({ "id": "characters:bob", "name": "Bob" })],
        edges: vec![serde_json::json!({ "relationship_type": "Friend" })],
        depth: 1,
    };

    let serialized = serde_json::to_string(&neighborhood).expect("Should serialize neighborhood");
    assert!(serialized.contains("characters:alice"));
    assert!(serialized.contains("characters:bob"));
    assert!(serialized.contains("Friend"));

    let deserialized: GraphNeighborhood =
        serde_json::from_str(&serialized).expect("Should deserialize neighborhood");
    assert_eq!(deserialized.depth, 1);
    assert_eq!(deserialized.center_id, "characters:alice");
}

#[test]
fn test_graph_edge_dto_construction() {
    let edge: GraphEdge<String, String> = GraphEdge {
        edge_id: "knows:1".to_string(),
        edge_data: "friendship".to_string(),
        node: "characters:bob".to_string(),
        direction: EdgeDirection::Outgoing,
    };

    assert_eq!(edge.edge_id, "knows:1");
    assert_eq!(edge.direction as u8, EdgeDirection::Outgoing as u8);
}
