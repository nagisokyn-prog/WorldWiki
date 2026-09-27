use crate::logic::batch::errors::BatchError;
use crate::logic::models::EntityRel;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub async fn upsert_connections_batch_inner(
    db: &Surreal<Db>,
    project: &str,
    _source_type: &str,
    source_id: &str,
    connections: Vec<EntityRel>,
) -> Result<(), BatchError> {
    let clean_pid = project.trim().replace("projects:", "");

    let from_raw = source_id.split_once(':').map(|(_, b)| b).unwrap_or(source_id);
    let from_clean = from_raw.trim_matches('⟨').trim_matches('⟩').trim_matches('`');

    let mut connection_objs: Vec<serde_json::Value> = Vec::new();

    for rel in connections {
        let EntityRel {
            out,
            r#in,
            rel_type,
            description,
            strength,
            attributes,
            start_chapter,
            end_chapter,
            ..
        } = rel;

        let target_raw = out.unwrap_or_default();
        if target_raw.is_empty() {
            continue;
        }

        let target_clean = target_raw.split_once(':').map(|(_, b)| b).unwrap_or(&target_raw).trim_matches('⟨').trim_matches('⟩').trim_matches('`').to_string();
        let src_clean = r#in
            .as_deref()
            .map(|s| s.split_once(':').map(|(_, b)| b).unwrap_or(s).trim_matches('⟨').trim_matches('⟩').trim_matches('`').to_string())
            .unwrap_or_else(|| from_clean.to_string());

        let clean_start = start_chapter.filter(|s| !s.trim().is_empty()).map(|s| s.trim().replace("chapters:", ""));
        let clean_end = end_chapter.filter(|s| !s.trim().is_empty()).map(|s| s.trim().replace("chapters:", ""));

        connection_objs.push(serde_json::json!({
            "source": src_clean,
            "target": target_clean,
            "rel_type": rel_type,
            "description": description.unwrap_or_default(),
            "strength": strength,
            "attributes": attributes,
            "start_chapter": clean_start,
            "end_chapter": clean_end,
        }));
    }

    let mut res = db
        .query("fn::batch_upsert_connections(type::record('projects', $p), type::record('entities', $src), $conns);")
        .bind(("p", clean_pid))
        .bind(("src", from_clean.to_string()))
        .bind(("conns", connection_objs))
        .await?;

    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(BatchError::Transaction(format!("{:?}", errors)));
    }

    Ok(())
}
