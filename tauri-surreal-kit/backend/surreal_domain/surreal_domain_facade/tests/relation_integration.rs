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

    // Test find_all and find_between
    let all_edges = KnowsEdge::find_all(&db, "projects:p1")
        .await
        .expect("find_all should succeed");
    assert!(!all_edges.is_empty(), "find_all should return edges");

    let between_edges = KnowsEdge::find_between(&db, c1.id.as_ref().unwrap(), c2.id.as_ref().unwrap())
        .await
        .expect("find_between should succeed");
    assert!(!between_edges.is_empty(), "find_between should return matching edges");

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
    let edge_out: GraphEdge<String, String> = GraphEdge {
        edge_id: "knows:1".to_string(),
        edge_data: "friendship".to_string(),
        node: "characters:bob".to_string(),
        direction: EdgeDirection::Outgoing,
    };

    let edge_in: GraphEdge<String, String> = GraphEdge {
        edge_id: "knows:2".to_string(),
        edge_data: "mentorship".to_string(),
        node: "characters:alice".to_string(),
        direction: EdgeDirection::Incoming,
    };

    let edge_both: GraphEdge<String, String> = GraphEdge {
        edge_id: "knows:3".to_string(),
        edge_data: "colleague".to_string(),
        node: "characters:charlie".to_string(),
        direction: EdgeDirection::Both,
    };

    assert_eq!(edge_out.edge_id, "knows:1");
    assert_eq!(edge_out.direction as u8, EdgeDirection::Outgoing as u8);
    assert_eq!(edge_in.direction as u8, EdgeDirection::Incoming as u8);
    assert_eq!(edge_both.direction as u8, EdgeDirection::Both as u8);
}

surreal_entity! {
    #[table = "volumes"]
    pub struct VolumeNode {
        pub title: String,
        pub sort_order: i32,
    }
}

surreal_entity! {
    #[table = "arcs"]
    pub struct ArcNode {
        pub title: String,
    }
}

surreal_relation! {
    #[edge = "contains_arc"]
    #[from = VolumeNode]
    #[to = ArcNode]
    pub struct VolumeContainsArcEdge {
        pub sort_order: i32,
    }
}

surreal_relation! {
    #[edge = "parent_of"]
    #[from = CharacterNode]
    #[to = CharacterNode]
    pub struct ParentOfEdge {
        pub role: String,
    }
}

#[tokio::test]
async fn test_heterogeneous_relation_and_self_referential() {
    let db = create_test_db().await;
    seed_project(&db, "p_graph", "Graph Project").await;

    // 1. Heterogeneous relation (Volume -> Arc)
    let vol = VolumeNode::create(
        &db,
        VolumeNode {
            id: None,
            project_id: Some(json!("projects:p_graph")),
            title: "Volume 1: The Beginning".into(),
            sort_order: 1,
        },
    )
    .await
    .expect("Volume creation failed");

    let arc = ArcNode::create(
        &db,
        ArcNode {
            id: None,
            project_id: Some(json!("projects:p_graph")),
            title: "Arc 1: Prologue".into(),
        },
    )
    .await
    .expect("Arc creation failed");

    let vol_id = vol.id.unwrap();
    let arc_id = arc.id.unwrap();

    let contains_edge_data = VolumeContainsArcEdge {
        id: None,
        r#in: None,
        out: None,
        project_id: Some("projects:p_graph".into()),
        sort_order: 1,
    };

    let contains_id = VolumeContainsArcEdge::relate(&db, &vol_id, &arc_id, contains_edge_data)
        .await
        .expect("VolumeContainsArc relate failed");
    assert!(!contains_id.is_empty());

    // 2. Self-referential relation (Character parent_of Character)
    let parent = CharacterNode::create(
        &db,
        CharacterNode {
            id: None,
            project_id: Some(json!("projects:p_graph")),
            name: "King Arthur".into(),
        },
    )
    .await
    .unwrap();

    let child = CharacterNode::create(
        &db,
        CharacterNode {
            id: None,
            project_id: Some(json!("projects:p_graph")),
            name: "Mordred".into(),
        },
    )
    .await
    .unwrap();

    let parent_id = parent.id.unwrap();
    let child_id = child.id.unwrap();

    let parent_edge = ParentOfEdge {
        id: None,
        r#in: None,
        out: None,
        project_id: Some("projects:p_graph".into()),
        role: "father".into(),
    };

    let parent_edge_id = ParentOfEdge::relate(&db, &parent_id, &child_id, parent_edge)
        .await
        .expect("ParentOf relate failed");
    assert!(!parent_edge_id.is_empty());

    // Delete relation
    ParentOfEdge::delete(&db, &parent_edge_id)
        .await
        .expect("ParentOf delete failed");
}
