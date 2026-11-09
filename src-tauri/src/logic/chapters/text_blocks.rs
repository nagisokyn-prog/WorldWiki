use super::errors::ChapterError;
use surrealdb::{Surreal, engine::local::Db};

pub async fn save_text_blocks_inner(
    db: &Surreal<Db>,
    _project: &str,
    chapter_id: &str,
    html: &str,
) -> Result<(), ChapterError> {
    use scraper::{Html, Selector};

    let clean_cid = chapter_id.trim().replace("chapters:", "");

    let blocks = {
        let document = Html::parse_document(html);
        let selector = Selector::parse("p")
            .map_err(|e| ChapterError::InvalidData(format!("Failed to parse selector: {:?}", e)))?;
        let mut blocks: Vec<(String, String, String)> = Vec::new();

        for (i, p) in document.select(&selector).enumerate() {
            let tag = p.value().attr("data-semantic-tag").unwrap_or("desc");
            let btype = match tag {
                "desc" => "description",
                "dialog" => "dialogue",
                _ => tag,
            };
            let raw_block_id = p
                .value()
                .attr("data-block-id")
                .or_else(|| p.value().attr("data-id"))
                .or_else(|| p.value().attr("id"))
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("para-{}", i + 1));

            let block_id = if raw_block_id.starts_with("blk_") {
                raw_block_id
            } else {
                format!("blk_{}_{}", clean_cid, raw_block_id)
            };

            let content = p.text().collect::<Vec<_>>().join("").trim().to_string();
            blocks.push((block_id, btype.to_string(), content));
        }
        blocks
    };

    let block_objects: Vec<serde_json::Value> = blocks
        .into_iter()
        .enumerate()
        .map(|(i, (bid, btype, content))| {
            serde_json::json!({
                "id": bid,
                "block_type": btype,
                "order_index": i,
                "content": content
            })
        })
        .collect();

    let mut attempts = 0;
    loop {
        attempts += 1;
        let mut res = db
            .query("fn::save_text_blocks(type::record('chapters', $c), $blocks);")
            .bind(("c", clean_cid.clone()))
            .bind(("blocks", block_objects.clone()))
            .await?;

        let errs = res.take_errors();
        if let Some(e) = errs.values().next() {
            let err_str = e.to_string();
            if (err_str.contains("Write conflict") || err_str.contains("-32009")) && attempts < 3 {
                tokio::time::sleep(tokio::time::Duration::from_millis(50 * attempts)).await;
                continue;
            }
            return Err(ChapterError::Transaction(format!(
                "save_text_blocks error: {}",
                e
            )));
        }
        break;
    }

    Ok(())
}
