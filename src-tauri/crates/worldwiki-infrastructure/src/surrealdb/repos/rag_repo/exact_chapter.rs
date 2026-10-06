use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub(crate) async fn fetch_exact_chapter(
    db: &Surreal<Db>,
    p_raw: &str,
    p_clean: &str,
    q_canon: &str,
    q_lower: &str,
) -> Vec<Value> {
    let mut list = Vec::new();
    let is_chapter_req = q_canon.contains("глав") || q_canon.contains("chapter");
    if is_chapter_req {
        let num_opt = q_lower.split_whitespace().find_map(|word| {
            word.trim_matches(|c: char| !c.is_numeric())
                .parse::<u32>()
                .ok()
        });

        if let Some(num) = num_opt {
            let num_str = num.to_string();
            let exact_sql = "SELECT id, title, content, 'chapter' AS source_type FROM chapters WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw) AND (title CONTAINS $num_str OR title CONTAINS 'Глава ' + $num_str OR title CONTAINS 'Chapter ' + $num_str) LIMIT 1";
            if let Ok(mut resp) = db
                .query(exact_sql)
                .bind(("p_raw", p_raw.to_string()))
                .bind(("p_clean", p_clean.to_string()))
                .bind(("num_str", num_str))
                .await
            {
                if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                    for r in rows {
                        list.push(r);
                    }
                }
            }
        }
    }
    list
}
