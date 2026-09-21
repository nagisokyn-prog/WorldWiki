use crate::logic::volumes::errors::VolumeError;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub async fn reorder_node_inner(
    db: &Surreal<Db>,
    _project: &str,
    node_type: &str,
    id: &str,
    sort_order: i64,
) -> Result<(), VolumeError> {
    let clean_id = if id.contains(':') {
        id.to_string()
    } else {
        format!("{}s:{}", node_type, id)
    };

    db.query("UPDATE contains SET sort_order = $order WHERE out = type::record($id)")
        .bind(("id", clean_id))
        .bind(("order", sort_order))
        .await?;

    Ok(())
}
