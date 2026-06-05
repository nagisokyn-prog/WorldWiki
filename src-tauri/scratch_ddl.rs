use surrealdb::engine::local::Mem;
use surrealdb::Surreal;
use std::fs;

#[tokio::main]
async fn main() {
    let db = Surreal::new::<Mem>(()).await.unwrap();
    let sql = fs::read_to_string("c:\\Users\\Administrator\\Desktop\\world-wiki\\src\\logic\\surreal_schema.surql").unwrap();
    let res = db.query(&sql).await;
    match res {
        Ok(mut res) => {
            let errs = res.take_errors();
            if !errs.is_empty() {
                println!("DDL ERROR: {:?}", errs);
            } else {
                println!("DDL OK");
            }
        }
        Err(e) => println!("PARSE ERROR: {:?}", e),
    }
}
