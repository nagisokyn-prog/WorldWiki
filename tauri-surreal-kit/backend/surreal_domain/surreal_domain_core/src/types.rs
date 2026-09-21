use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchKind {
    Fulltext,
    Vector,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub entity: T,
    pub score: f64,
    pub kind: SearchKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarResult<T> {
    pub entity: T,
    pub similarity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeDirection {
    Outgoing,
    Incoming,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge<E, T> {
    pub edge_id: String,
    pub edge_data: E,
    pub node: T,
    pub direction: EdgeDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNeighborhood {
    pub center_id: String,
    pub nodes: Vec<serde_json::Value>,
    pub edges: Vec<serde_json::Value>,
    pub depth: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChapterRange {
    pub start_chapter: Option<String>,
    pub end_chapter: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chapter_range_default() {
        let range = ChapterRange::default();
        assert_eq!(range.start_chapter, None);
        assert_eq!(range.end_chapter, None);
    }

    #[test]
    fn test_search_result_roundtrip() {
        let result = SearchResult {
            entity: 42,
            score: 0.75,
            kind: SearchKind::Hybrid,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: SearchResult<i32> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.score, 0.75);
        assert_eq!(serde_json::to_string(&parsed.kind).unwrap(), "\"Hybrid\"");
    }

    #[test]
    fn test_similar_result_clone() {
        let sim = SimilarResult {
            entity: "lore".to_string(),
            similarity: 0.9,
        };
        let clone = sim.clone();
        assert_eq!(clone.similarity, 0.9);
    }

    #[test]
    fn test_edge_direction_variants() {
        for dir in [EdgeDirection::Outgoing, EdgeDirection::Incoming, EdgeDirection::Both] {
            let json_str = serde_json::to_string(&dir).unwrap();
            let back: EdgeDirection = serde_json::from_str(&json_str).unwrap();
            assert!(!format!("{:?}", back).is_empty());
        }
    }

    #[test]
    fn test_graph_edge_and_neighborhood() {
        let edge = GraphEdge {
            edge_id: "knows:1".into(),
            edge_data: serde_json::json!({"since": 2020}),
            node: serde_json::json!({"name": "Alice"}),
            direction: EdgeDirection::Outgoing,
        };
        let json_str = serde_json::to_string(&edge).unwrap();
        let back: GraphEdge<serde_json::Value, serde_json::Value> =
            serde_json::from_str(&json_str).unwrap();
        assert_eq!(back.edge_id, "knows:1");

        let hood = GraphNeighborhood {
            center_id: "characters:1".into(),
            nodes: vec![serde_json::json!({"id": "characters:1"})],
            edges: vec![serde_json::json!({"id": "knows:1"})],
            depth: 2,
        };
        let json_str = serde_json::to_string(&hood).unwrap();
        let back: GraphNeighborhood = serde_json::from_str(&json_str).unwrap();
        assert_eq!(back.depth, 2);
        assert_eq!(back.nodes.len(), 1);
    }
}
