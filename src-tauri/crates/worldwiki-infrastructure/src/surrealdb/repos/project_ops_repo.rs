use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};
use worldwiki_domain::errors::DomainError;

pub fn clean_project_id(raw: &str) -> String {
    raw.trim()
        .trim_start_matches("projects:")
        .trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'')
        .to_string()
}

pub fn sanitize_project_payload(project_data: &Value) -> Value {
    let mut data = project_data.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id");
        obj.remove("data");
        obj.remove("perfLevel");
    }
    data
}

pub async fn get_projects(db: &Surreal<Db>) -> Result<Vec<Value>, DomainError> {
    let mut res = db
        .query("RETURN fn::get_projects_list();")
        .await
        .map_err(DomainError::constraint_violation)?;
    let projects: Vec<Value> = res.take(0).map_err(DomainError::constraint_violation)?;
    Ok(projects)
}

pub async fn create_project(db: &Surreal<Db>, project_data: Value) -> Result<String, DomainError> {
    let name = project_data
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| DomainError::Validation("No name provided".to_string()))?
        .to_string();
    let data = sanitize_project_payload(&project_data);
    let clean_name = clean_project_id(&name);
    db.upsert::<Option<Value>>(("projects", clean_name.as_str()))
        .content(data)
        .await
        .map_err(DomainError::constraint_violation)?;
    Ok(clean_name)
}

pub async fn delete_project(db: &Surreal<Db>, name: &str) -> Result<String, DomainError> {
    let mut attempts = 0;
    loop {
        let query_res = db
            .query("RETURN fn::delete_project_cascade($name);")
            .bind(("name", name.to_string()))
            .await;

        match query_res {
            Ok(mut res) => match res.take::<Option<Value>>(0) {
                Ok(_) => return Ok(name.to_string()),
                Err(e) => {
                    let err_str = e.to_string();
                    if attempts < 15
                        && (err_str.contains("Transaction conflict")
                            || err_str.contains("can be retried")
                            || err_str.contains("TransactionConflict")
                            || err_str.contains("try again"))
                    {
                        attempts += 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(100 * attempts))
                            .await;
                        continue;
                    }
                    return Err(DomainError::constraint_violation(e));
                }
            },
            Err(e) => {
                let err_str = e.to_string();
                if attempts < 15
                    && (err_str.contains("Transaction conflict")
                        || err_str.contains("can be retried")
                        || err_str.contains("TransactionConflict")
                        || err_str.contains("try again"))
                {
                    attempts += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(100 * attempts)).await;
                    continue;
                }
                return Err(DomainError::constraint_violation(e));
            }
        }
    }
}

pub async fn get_project_config(db: &Surreal<Db>, name: &str) -> Result<Value, DomainError> {
    let mut query_res = db
        .query("RETURN fn::get_project_config($name);")
        .bind(("name", name.to_string()))
        .await
        .map_err(DomainError::constraint_violation)?;
    let res: Option<Value> = query_res
        .take(0)
        .map_err(DomainError::constraint_violation)?;
    Ok(res.unwrap_or(json!({})))
}

pub async fn save_project_config(
    db: &Surreal<Db>,
    name: &str,
    config: Value,
) -> Result<Value, DomainError> {
    let data = sanitize_project_payload(&config);
    let clean_name = clean_project_id(name);

    let find_sql = "SELECT type::string(id) AS id FROM projects WHERE id = fn::normalize_project_id($name) OR name = $name LIMIT 1;";
    let mut find_res = db
        .query(find_sql)
        .bind(("name", clean_name))
        .await
        .map_err(DomainError::constraint_violation)?;
    let found: Option<Value> = find_res
        .take(0)
        .map_err(DomainError::constraint_violation)?;

    let target_rec = found
        .and_then(|f| f.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()));

    let Some(rec_str) = target_rec else {
        return Err(DomainError::Validation(format!(
            "Project '{}' not found for update",
            name
        )));
    };

    let rec_id = clean_project_id(&rec_str);
    let update_res: Option<Value> = db
        .update(("projects", rec_id.as_str()))
        .merge(data)
        .await
        .map_err(DomainError::constraint_violation)?;

    if update_res.is_none() {
        return Err(DomainError::Validation(format!(
            "Project '{}' update yielded 0 records",
            name
        )));
    }

    Ok(json!({ "success": true }))
}

#[cfg(feature = "razrab")]
pub async fn execute_raw_surql(db: &Surreal<Db>, query: &str) -> Result<Value, DomainError> {
    let mut res = db
        .query(query)
        .await
        .map_err(DomainError::validation)?;

    let errors = res.take_errors();
    if let Some((_, err)) = errors.into_iter().next() {
        return Err(DomainError::Validation(err.to_string()));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_project_id_strips_prefix_and_quotes() {
        assert_eq!(clean_project_id("projects:`my_proj`"), "my_proj");
        assert_eq!(clean_project_id("⟨alpha⟩"), "alpha");
    }

    #[test]
    fn sanitize_project_payload_removes_internal_keys() {
        let input = json!({ "id": "p1", "data": {}, "perfLevel": "high", "name": "Test" });
        let out = sanitize_project_payload(&input);
        assert_eq!(out, json!({ "name": "Test" }));
    }
}
