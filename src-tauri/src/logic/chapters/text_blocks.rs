use super::errors::ChapterError;
use surrealdb::{engine::local::Db, Surreal};

pub async fn save_text_blocks_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    html: &str,
) -> Result<(), ChapterError> {
    use scraper::{Html, Selector};

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

    let clean_pid = project.trim().replace("projects:", "");
    let clean_cid = chapter_id.trim().replace("chapters:", "");

    let block_objects: Vec<serde_json::Value> = blocks
        .into_iter()
        .enumerate()
        .map(|(i, (btype, content))| {
            serde_json::json!({
                "block_type": btype,
                "order_index": i,
                "content": content
            })
        })
        .collect();

    let mut res = db
        .query("fn::save_text_blocks(type::record('projects', $p), type::record('chapters', $c), $blocks);")
        .bind(("p", clean_pid))
        .bind(("c", clean_cid))
        .bind(("blocks", block_objects))
        .await?;

    let errs = res.take_errors();
    if let Some(e) = errs.values().next() {
        return Err(ChapterError::Transaction(format!(
            "save_text_blocks error: {}",
            e
        )));
    }

    Ok(())
}
