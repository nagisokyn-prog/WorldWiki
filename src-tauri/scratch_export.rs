use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;

#[tokio::main]
async fn main() {
    let db = Surreal::new::<SurrealKv>("data/surreal_db").await.unwrap();
    db.use_ns("worldwriter").use_db("worldwriter").await.unwrap();
    let res = db.query("EXPORT TO 'file://test_export.surql'").await;
    println!("{:?}", res);
}
