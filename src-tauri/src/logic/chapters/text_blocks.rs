use super::errors::ChapterError;
use surrealdb::{engine::local::Db, Surreal};

pub async fn save_text_blocks_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    html: &str,
) -> Result<(), ChapterError> {
    use scraper::{Html, Selector};

    let pid_safe = if project.contains(':') {
        project.to_string()
    } else {
        format!("projects:{}", project)
    };
    let cid_safe = if chapter_id.contains(':') {
        chapter_id.to_string()
    } else {
        format!("chapters:{}", chapter_id)
    };

    let blocks = {
        let document = Html::parse_document(html);
        let selector = Selector::parse("p")
            .map_err(|e| ChapterError::InvalidData(format!("Failed to parse selector: {:?}", e)))?;
        let mut blocks: Vec<(String, String)> = Vec::new();

        for p in document.select(&selector) {
            let tag = p.value().attr("data-semantic-tag").unwrap_or("desc");
            let btype = match tag {
                "desc" => "description",
                "dialog" => "dialogue",
                _ => tag,
            };
            let content = p.text().collect::<Vec<_>>().join("").trim().to_string();
            if !content.is_empty() {
                blocks.push((btype.to_string(), content));
            }
        }
        blocks
    };

    let mut sql = String::new();
    sql.push_str("BEGIN TRANSACTION;\n");
    sql.push_str("DELETE text_blocks WHERE chapter_id = type::record($chapter_id) AND project_id = type::record($project_id);\n");

    let mut bindings: Vec<(String, String)> = Vec::new();

    for (i, (btype, content)) in blocks.into_iter().enumerate() {
        sql.push_str(&format!(
            "CREATE text_blocks SET project_id = type::record($project_id), chapter_id = type::record($chapter_id), block_type = $btype_{}, order_index = {}, content = $content_{};\n",
            i, i, i
        ));

        bindings.push((format!("btype_{}", i), btype));
        bindings.push((format!("content_{}", i), content));
    }

    sql.push_str("COMMIT TRANSACTION;\n");

    let mut q = db
        .query(sql)
        .bind(("project_id", pid_safe))
        .bind(("chapter_id", cid_safe));

    for (k, v) in bindings {
        q = q.bind((k, v));
    }

    let mut res = q.await?;
    let errs = res.take_errors();
    if let Some(e) = errs.values().next() {
        return Err(ChapterError::Transaction(format!(
            "save_text_blocks error: {}",
            e
        )));
    }

    Ok(())
}
