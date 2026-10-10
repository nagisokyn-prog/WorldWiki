use serde_json::Value;
use surrealdb::{engine::local::Db, Surreal};
use crate::logic::projects::errors::ProjectError;

pub async fn execute_raw_surql_inner(
    db: &Surreal<Db>,
    query: &str,
) -> Result<Value, ProjectError> {
    let mut res = db
        .query(query)
        .await
        .map_err(|e| ProjectError::InvalidData(e.to_string()))?;

    let errors = res.take_errors();
    if let Some((_, err)) = errors.into_iter().next() {
        return Err(ProjectError::InvalidData(err.to_string()));
    }

    let mut results: Vec<Value> = Vec::new();
    let num_stmts = res.num_statements();
    for idx in 0..num_stmts {
        if let Ok(vals) = res.take::<Vec<Value>>(idx) {
            for v in vals {
                results.push(v);
            }
        } else if let Ok(Some(val)) = res.take::<Option<Value>>(idx) {
            results.push(val);
        }
    }

    if results.is_empty() {
        Ok(Value::Array(vec![]))
    } else if results.len() == 1 {
        Ok(results.remove(0))
    } else {
        Ok(Value::Array(results))
    }
}
