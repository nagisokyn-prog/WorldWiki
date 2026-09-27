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
    let table = if node_type == "volume" || node_type == "volumes" {
        "volumes"
    } else {
        "chapters"
    };
    let raw_id = id.split_once(':').map(|(_, b)| b).unwrap_or(id);

    db.query("fn::reorder_node(type::record($table, $id), $order);")
        .bind(("table", table))
        .bind(("id", raw_id))
        .bind(("order", sort_order))
        .await?;

    Ok(())
}
