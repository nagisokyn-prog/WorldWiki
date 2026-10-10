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
    let clean_pid = project.trim().replace("projects:", "");

    let mut max_order_res = db
        .query("RETURN fn::get_max_volume_sort_order(type::record('projects', $p));")
        .bind(("p", clean_pid.clone()))
        .await?;
    let max_order: i64 = match max_order_res.take::<Option<i64>>(0)? {
        Some(order) => order,
        None => -1,
    };
    let next_order = max_order + 1;

    let query = "RETURN fn::create_volume_node(type::record('projects', $p), $title, $order);";
    let mut create_res = db
        .query(query)
        .bind(("p", clean_pid))
        .bind(("title", title))
        .bind(("order", next_order))
        .await?;

    let vol: Option<serde_json::Value> = create_res.take(0)?;
    Ok(serde_json::json!(vol))
}

pub async fn update_volume_inner(
    db: &Surreal<Db>,
    id: &str,
    title: &str,
) -> Result<(), VolumeError> {
    let clean_id = id.trim_start_matches("volumes:").to_string();
    db.query("fn::update_volume_title(type::record('volumes', $id), $title);")
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
        .query("fn::assign_chapter_node($parent, $chap);")
        .bind(("chap", chap_rec))
        .bind(("parent", new_parent))
        .await?;

    let errs = res.take_errors();
    if let Some(e) = errs.values().next() {
        return Err(VolumeError::OperationFailed(format!(
            "assign_chapter error: {}",
            e
        )));
    }

    let updated_count =
        auto_extend_entities_inner(db, project, &clean_chap, volume_id.clone()).await?;

    Ok(AutoExtendResult {
        chapter_id: clean_chap,
        volume_id,
        updated_count,
    })
}
