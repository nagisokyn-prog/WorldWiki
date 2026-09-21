use crate::logic::volumes::auto_extend::auto_extend_entities_inner;
use crate::logic::volumes::errors::VolumeError;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AutoExtendResult {
    pub chapter_id: String,
    pub volume_id: Option<String>,
    pub updated_count: u64,
}

pub async fn create_volume_inner(
    db: &Surreal<Db>,
    project: &str,
    title: &str,
) -> Result<serde_json::Value, VolumeError> {
    let pid_raw = project.trim().replace("projects:", "");
    let proj_rec = RecordId::new("projects", pid_raw.as_str());

    let mut max_order_res = db
        .query(
            r#"
        SELECT math::max(sort_order) AS max_order FROM contains WHERE in = $proj GROUP ALL
    "#,
        )
        .bind(("proj", RecordId::new("projects", pid_raw.as_str())))
        .await?;
    let max_orders: Vec<serde_json::Value> = max_order_res.take(0).unwrap_or_default();
    let next_order = max_orders
        .first()
        .and_then(|v| v.get("max_order"))
        .and_then(|n| n.as_i64())
        .unwrap_or(-1)
        + 1;

    let mut create_res = db
        .query(
            r#"
        LET $vol = (CREATE volumes SET project_id = $proj, title = $title RETURN VALUE id)[0];
        RELATE $proj -> contains -> $vol SET sort_order = $order;
        SELECT id, title, project_id, $order AS sort_order FROM $vol;
    "#,
        )
        .bind(("proj", proj_rec))
        .bind(("title", title))
        .bind(("order", next_order))
        .await?;

    let vols: Vec<serde_json::Value> = create_res.take(2).unwrap_or_default();
    Ok(serde_json::json!(vols.first()))
}

pub async fn update_volume_inner(
    db: &Surreal<Db>,
    id: &str,
    title: &str,
) -> Result<(), VolumeError> {
    let clean_id = if id.contains(':') {
        id.to_string()
    } else {
        format!("volumes:{}", id)
    };
    db.query("UPDATE type::record($id) SET title = $title")
        .bind(("id", clean_id))
        .bind(("title", title.to_string()))
        .await?;
    Ok(())
}

pub async fn assign_chapter_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    volume_id: Option<String>,
) -> Result<AutoExtendResult, VolumeError> {
    let pid_raw = project.trim().replace("projects:", "");
    let clean_chap = if chapter_id.contains(':') {
        chapter_id.to_string()
    } else {
        format!("chapters:{}", chapter_id)
    };

    fn make_record(table: &str, full_id: &str) -> RecordId {
        let raw = full_id
            .split(':')
            .nth(1)
            .unwrap_or(full_id)
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim_matches('`');
        RecordId::new(table, raw)
    }

    let new_parent: RecordId = if let Some(ref v) = volume_id {
        make_record("volumes", v)
    } else {
        RecordId::new("projects", pid_raw.as_str())
    };

    let chap_raw = clean_chap
        .split(':')
        .nth(1)
        .unwrap_or(&clean_chap)
        .trim_matches('⟨')
        .trim_matches('⟩')
        .trim_matches('`');
    let chap_rec = RecordId::new("chapters", chap_raw);

    let mut res = db
        .query(
            r#"
        DELETE contains WHERE out = $chap;
        RELATE $parent -> contains -> $chap SET sort_order = 9999;
    "#,
        )
        .bind(("chap", chap_rec))
        .bind(("parent", new_parent))
        .await?;

    let errs = res.take_errors();
    if let Some(e) = errs.values().next() {
        return Err(VolumeError::OperationFailed(format!("assign_chapter error: {}", e)));
    }

    let updated_count =
        auto_extend_entities_inner(db, project, &clean_chap, volume_id.clone()).await?;

    Ok(AutoExtendResult {
        chapter_id: clean_chap,
        volume_id,
        updated_count,
    })
}
