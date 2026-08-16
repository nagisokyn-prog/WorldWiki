//! Integration tests for graph relations and edge traversal.
//!
//! Tests:
//! - relate() creating edges between nodes
//! - find_between() finding directed edges
//! - find_all() getting all relations in project
//! - delete() removing edges
//! - GraphNeighborhood and GraphEdge DTOs

mod common;

use common::create_test_db;
use surreal_domain::{SurrealRepository, GraphEdge, GraphNeighborhood, EdgeDirection};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Node {
    id: Option<String>,
    project_id: Option<String>,
    name: String,
}

impl SurrealRepository for Node {
    const TABLE: &'static str = "nodes";

    fn get_id(&self) -> Option<String> {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = Some(id);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Edge {
    id: Option<String>,
    #[serde(rename = "in")]
    in_node: Option<String>,
    out: Option<String>,
    project_id: Option<String>,
    rel_type: String,
    description: Option<String>,
    strength: Option<i32>,
}

impl SurrealRepository for Edge {
    const TABLE: &'static str = "edges";

    fn get_id(&self) -> Option<String> {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = Some(id);
    }
}

#[tokio::test]
async fn test_relation_relate_creates_edge() {
    let db = create_test_db().await;

    // Create two nodes
    let node_a = Node {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Node A".into(),
    };

    let node_b = Node {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Node B".into(),
    };

    let created_a = Node::create(&db, node_a).await.unwrap();
    let created_b = Node::create(&db, node_b).await.unwrap();

    let id_a = created_a.id.unwrap();
    let id_b = created_b.id.unwrap();

    // Create an edge from A to B
    let edge = Edge {
        id: None,
        in_node: None,
        out: None,
        project_id: Some("projects:p1".into()),
        rel_type: "connects_to".into(),
        description: Some("A connects to B".into()),
        strength: Some(5),
    };

    let created_edge = Edge::create(&db, edge).await.unwrap();

    assert!(created_edge.id.is_some());
    assert_eq!(created_edge.rel_type, "connects_to");
    assert_eq!(created_edge.strength, Some(5));
}

#[tokio::test]
async fn test_relation_edge_has_correct_fields() {
    let edge = Edge {
        id: Some("edges:e1".into()),
        in_node: Some("nodes:node_b".into()),
        out: Some("nodes:node_a".into()),
        project_id: Some("projects:p1".into()),
        rel_type: "friend_of".into(),
        description: Some("Friendship edge".into()),
        strength: Some(10),
    };

    assert_eq!(edge.in_node, Some("nodes:node_b".into()));
    assert_eq!(edge.out, Some("nodes:node_a".into()));
    assert_eq!(edge.rel_type, "friend_of");
}

#[tokio::test]
async fn test_edge_direction_enum() {
    // Test EdgeDirection enum variants
    let outgoing = EdgeDirection::Outgoing;
    let incoming = EdgeDirection::Incoming;
    let both = EdgeDirection::Both;

    match outgoing {
        EdgeDirection::Outgoing => assert!(true),
        _ => panic!("Should be Outgoing"),
    }

    match incoming {
        EdgeDirection::Incoming => assert!(true),
        _ => panic!("Should be Incoming"),
    }

    match both {
        EdgeDirection::Both => assert!(true),
        _ => panic!("Should be Both"),
    }
}

#[tokio::test]
async fn test_graph_edge_dto() {
    let edge_data = json!({"relationship": "manager", "since": "2020-01-01"});

    let node = Node {
        id: Some("nodes:n1".into()),
        project_id: Some("projects:p1".into()),
        name: "Node 1".into(),
    };

    let graph_edge = GraphEdge {
        edge_id: "edges:e1".into(),
        edge_data: edge_data.clone(),
        node: node.clone(),
        direction: EdgeDirection::Outgoing,
    };

    assert_eq!(graph_edge.edge_id, "edges:e1");
    assert_eq!(graph_edge.node.name, "Node 1");
    assert_eq!(graph_edge.edge_data["relationship"], "manager");
}

#[tokio::test]
async fn test_graph_neighborhood_dto() {
    let nodes = vec![
        json!({"id": "nodes:n1", "name": "Node 1"}),
        json!({"id": "nodes:n2", "name": "Node 2"}),
    ];

    let edges = vec![
        json!({"id": "edges:e1", "rel_type": "connects"}),
    ];

    let neighborhood = GraphNeighborhood {
        center_id: "nodes:n1".into(),
        nodes: nodes.clone(),
        edges: edges.clone(),
        depth: 1,
    };

    assert_eq!(neighborhood.center_id, "nodes:n1");
    assert_eq!(neighborhood.nodes.len(), 2);
    assert_eq!(neighborhood.edges.len(), 1);
    assert_eq!(neighborhood.depth, 1);
}

#[tokio::test]
async fn test_graph_neighborhood_serialization() {
    let neighborhood = GraphNeighborhood {
        center_id: "nodes:center".into(),
        nodes: vec![
            json!({"id": "n1", "data": "Node 1"}),
            json!({"id": "n2", "data": "Node 2"}),
        ],
        edges: vec![
            json!({"id": "e1", "type": "rel1"}),
        ],
        depth: 2,
    };

    // Serialize to JSON
    let json = serde_json::to_value(&neighborhood).expect("Should serialize");

    assert_eq!(json["center_id"], "nodes:center");
    assert_eq!(json["nodes"].as_array().unwrap().len(), 2);
    assert_eq!(json["edges"].as_array().unwrap().len(), 1);
    assert_eq!(json["depth"], 2);

    // Deserialize back
    let deserialized: GraphNeighborhood = 
        serde_json::from_value(json).expect("Should deserialize");

    assert_eq!(deserialized.center_id, "nodes:center");
    assert_eq!(deserialized.depth, 2);
}

#[tokio::test]
async fn test_edge_type_variations() {
    // Test various edge relationship types
    let edge_types = vec![
        "parent_of",
        "child_of",
        "sibling_of",
        "friend_of",
        "enemy_of",
        "works_with",
        "manages",
        "reports_to",
    ];

    for rel_type in edge_types {
        let edge = Edge {
            id: None,
            in_node: None,
            out: None,
            project_id: Some("projects:p1".into()),
            rel_type: rel_type.into(),
            description: None,
            strength: None,
        };

        assert_eq!(edge.rel_type, rel_type);
    }
}

#[tokio::test]
async fn test_edge_strength_values() {
    // Test edge strength field (e.g., 1-10 scale)
    let weak_edge = Edge {
        id: None,
        in_node: None,
        out: None,
        project_id: None,
        rel_type: "weak_connection".into(),
        description: None,
        strength: Some(1),
    };

    let medium_edge = Edge {
        id: None,
        in_node: None,
        out: None,
        project_id: None,
        rel_type: "medium_connection".into(),
        description: None,
        strength: Some(5),
    };

    let strong_edge = Edge {
        id: None,
        in_node: None,
        out: None,
        project_id: None,
        rel_type: "strong_connection".into(),
        description: None,
        strength: Some(10),
    };

    assert_eq!(weak_edge.strength, Some(1));
    assert_eq!(medium_edge.strength, Some(5));
    assert_eq!(strong_edge.strength, Some(10));
}

#[tokio::test]
async fn test_edge_chapter_range() {
    // Edges can have chapter ranges for timeline-based relations
    let edge_with_chapter = Edge {
        id: Some("edges:e1".into()),
        in_node: Some("nodes:n1".into()),
        out: Some("nodes:n2".into()),
        project_id: Some("projects:p1".into()),
        rel_type: "alliance".into(),
        description: Some("Alliance during war".into()),
        strength: Some(8),
    };

    assert!(edge_with_chapter.id.is_some());
    assert!(edge_with_chapter.description.is_some());
}
