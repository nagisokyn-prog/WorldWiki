//! Graph time slice queries and projection.

use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{DirectedRelationshipEdgeDto, GraphNodeDto, GraphTimeSliceDto};
use worldwiki_domain::errors::DomainError;

#[derive(serde::Deserialize)]
struct GraphRaw {
    nodes: Vec<RawGraphNode>,
    edges: Vec<RawGraphEdge>,
}

#[derive(serde::Deserialize)]
struct RawGraphNode {
    id: String,
    name: String,
    entity_type: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    attributes: serde_json::Value,
}

#[derive(serde::Deserialize)]
struct RawGraphEdge {
    id: String,
    source_id: String,
    target_id: String,
    rel_type: String,
    description: Option<String>,
    strength: Option<i64>,
    start_chapter: Option<String>,
    start_order: Option<i32>,
    end_chapter: Option<String>,
    end_order: Option<i32>,
    inferred_start_m_abs: Option<i64>,
}

pub(crate) async fn get_graph_time_slice_impl(
    db: &Surreal<Db>,
    project_id: &str,
) -> Result<GraphTimeSliceDto, DomainError> {
    let proj_clean = project_id.trim_start_matches("projects:");
    let sql = "RETURN fn::get_graph_time_slice(type::record('projects', $p));";
    let mut res = db
        .query(sql)
        .bind(("p", proj_clean.to_string()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let raw: Option<GraphRaw> = crate::surrealdb::repos::helpers::take_one(&mut res, 0)?;
    let raw = raw.unwrap_or(GraphRaw {
        nodes: vec![],
        edges: vec![],
    });

    let nodes_dto = raw
        .nodes
        .into_iter()
        .map(|n| GraphNodeDto {
            id: n.id,
            name: n.name,
            entity_type: n.entity_type,
            tags: n.tags,
            attributes: n.attributes,
            x: 0.0,
            y: 0.0,
        })
        .collect();

    let mut edges_dto = Vec::new();
    for e in raw.edges {
        let needs_warning = e.start_chapter.is_some() && e.inferred_start_m_abs.is_none();
        edges_dto.push(DirectedRelationshipEdgeDto {
            id: e.id,
            source_id: e.source_id,
            target_id: e.target_id,
            rel_type: e.rel_type,
            description: e.description,
            strength: e.strength.unwrap_or(0) as i32,
            is_directed: true,
            start_chapter_id: e.start_chapter,
            start_chapter_order: e.start_order,
            end_chapter_id: e.end_chapter,
            end_chapter_order: e.end_order,
            start_m_abs: e.inferred_start_m_abs,
            end_m_abs: None,
            needs_m_abs_warning: needs_warning,
            is_revealed_to_reader: true,
            offset_px: 6.0,
        });
    }

    Ok(GraphTimeSliceDto {
        nodes: nodes_dto,
        edges: edges_dto,
    })
}
