use serde::{Deserialize, Serialize};
pub use ts_rs;

/// Trait that the user's AppState must implement to use generated Tauri commands.
/// This keeps the macro crate independent from any specific application structure.
///
/// # Example
/// use surreal_domain::SurrealDb;
/// use surrealdb::{Surreal, engine::local::Db};
///
/// struct AppState { db: Surreal<Db> }
///
/// impl SurrealDb for AppState {
///     fn surreal_db(&self) -> &Surreal<Db> { &self.db }
/// }
/// ```
pub trait SurrealDb: Send + Sync + 'static {
    type Connection: surrealdb::Connection;
    fn surreal_db(&self) -> &surrealdb::Surreal<Self::Connection>;
}

/// Проверка "объект не найден / таблица не существует" — трактуется как
/// пустой результат, а не ошибка.
fn is_not_found(e: &surrealdb::Error) -> bool {
    let msg = e.to_string();
    msg.contains("does not exist") || msg.contains("NotFound")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchKind {
    Fulltext,
    Vector,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub entity: T,
    pub score: f64,
    pub kind: SearchKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarResult<T> {
    pub entity: T,
    pub similarity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeDirection {
    Outgoing,
    Incoming,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge<E, T> {
    pub edge_id: String,
    pub edge_data: E,
    pub node: T,
    pub direction: EdgeDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNeighborhood {
    pub center_id: String,
    pub nodes: Vec<serde_json::Value>,
    pub edges: Vec<serde_json::Value>,
    pub depth: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChapterRange {
    pub start_chapter: Option<String>,
    pub end_chapter: Option<String>,
}

pub trait SurrealRepository: Serialize + serde::de::DeserializeOwned + Clone + Send + Sync + 'static {
    const TABLE: &'static str;
    fn get_fields() -> &'static [&'static str];
    fn get_option_fields() -> &'static [&'static str];
    fn get_id(&self) -> Option<String>;
    fn set_id(&mut self, id: String);

    #[allow(async_fn_in_trait)]
    async fn create<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, mut entity: Self) -> Result<Self, surrealdb::Error> {
        let mut val = serde_json::to_value(&entity).unwrap();
        // Структура всегда сериализуется в JSON-объект — defensive-ветка удалена.
        let map = {
            let obj = val.as_object_mut().expect("entity must serialize to a JSON object");
            obj.remove("id");
            obj.retain(|_, v| !v.is_null()); // Strip nulls
            obj.clone()
        };

        let mut query = format!("CREATE {} SET ", Self::TABLE);
        let mut assign_clauses = Vec::new();
        for key in map.keys() {
            assign_clauses.push(format!("{} = ${}", key, key));
        }
        query.push_str(&assign_clauses.join(", "));

        let mut db_query = db.query(query);
        
        // Bind all parameters
        for (k, v) in map.iter() {
            if let Some(s) = v.as_str() {
                let parts: Vec<&str> = s.split(':').collect();
                if parts.len() == 2 && !s.contains(' ') && !s.contains('{') {
                    // Bind as RecordId
                    db_query = db_query.bind((k.as_str(), surrealdb::types::RecordId::new(parts[0], parts[1])));
                } else {
                    db_query = db_query.bind((k.as_str(), v.clone()));
                }
            } else {
                db_query = db_query.bind((k.as_str(), v.clone()));
            }
        }

        let mut res = db_query.await?;
        // CREATE всегда возвращает ровно одну запись; ошибки statements
        // всплывают через take() — defensive match удалён.
        let items: Vec<serde_json::Value> = res.take(0)?;
        let res_val = items
            .into_iter()
            .next()
            .expect("CREATE must return the created record");
        let created: Self = serde_json::from_value(res_val).unwrap();
        entity.set_id(created.get_id().unwrap_or_default());
        Ok(created)
    }

    #[allow(async_fn_in_trait)]
    async fn find_by_id<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, id: &str) -> Result<Option<Self>, surrealdb::Error> {
        let parts: Vec<&str> = id.split(':').collect();
        if parts.len() == 2 && parts[0] != Self::TABLE {
            return Ok(None);
        }
                        let actual_id = if parts.len() == 2 { parts[1] } else { id };
        // Отсутствующая таблица приходит ошибкой NotFound → Ok(None);
        // реальные ошибки пробрасываются дальше.
        match db.select((Self::TABLE, actual_id)).await {
            Ok(res) => Ok(res.and_then(|v| serde_json::from_value(v).ok())),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("does not exist") || msg.contains("NotFound") {
                    Ok(None)
                } else {
                    Err(e)
                }
            }
        }
    }

    #[allow(async_fn_in_trait)]
    async fn find_all<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, project_id: &str) -> Result<Vec<Self>, surrealdb::Error> {
                let pid_raw = project_id.split(':').next_back().unwrap_or(project_id);
        let pid_str = format!("projects:{}", pid_raw);
        // Отсутствие таблицы приходит ошибкой NotFound (и на .await, и на
        // take()) — трактуем как пустой результат; остальное пробрасываем.
        let query_res = db.query(format!("SELECT * FROM {} WHERE project_id = $pid OR project_id = type::record('projects', $pid_raw) OR project_id = $pid_str", Self::TABLE))
            .bind(("pid", project_id.to_string()))
            .bind(("pid_raw", pid_raw.to_string()))
            .bind(("pid_str", pid_str))
            .await;

        let mut res = match query_res {
            Ok(r) => r,
            Err(ref e) if is_not_found(e) => return Ok(Vec::new()),
            Err(e) => return Err(e),
        };

        let entities = match res.take(0) {
            Ok(entities) => entities,
            Err(ref e) if is_not_found(e) => Vec::new(),
            Err(e) => {
                eprintln!("Error in find_all for table {}: {:?}", Self::TABLE, e);
                return Err(e);
            }
        };
        let mapped = entities
            .into_iter()
            .filter_map(|mut v| {
                if let Some(obj) = v.as_object_mut() {
                    for (_k, val) in obj.iter_mut() {
                        if val.is_object() {
                            let is_thing = val.get("tb").is_some() && val.get("id").is_some();
                            if is_thing {
                                let tb = val.get("tb").unwrap().as_str().unwrap_or("");
                                let id_field = val.get("id").unwrap();
                                let id_str = if let Some(s) = id_field.get("String").and_then(|s| s.as_str()) {
                                    s
                                } else {
                                    id_field.as_str().unwrap_or_default()
                                };
                                if !tb.is_empty() && !id_str.is_empty() {
                                    *val = serde_json::Value::String(format!("{}:{}", tb, id_str));
                                }
                            }
                        }
                    }
                }
                match serde_json::from_value::<Self>(v.clone()) {
                    Ok(e) => Some(e),
                    Err(e) => {
                        eprintln!("⚠️ find_all: Failed to deserialize entity: {:?}. Error: {}", v, e);
                        None
                    }
                }
            })
            .collect();
        Ok(mapped)
    }

    #[allow(async_fn_in_trait)]
    async fn save<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, entity: &Self) -> Result<Self, surrealdb::Error> {
        if let Some(id_str) = entity.get_id() {
            let parts: Vec<&str> = id_str.split(':').collect();
            let actual_id = if parts.len() == 2 { parts[1] } else { &id_str };
            
            let mut val = serde_json::to_value(entity).unwrap();
            let map = val.as_object_mut().unwrap();
            map.remove("id");
            // Don't strip nulls - they represent explicit None/null values that should be saved
            // The old code stripped nulls to avoid 'expected NONE found NULL' errors,
            // but this broke the ability to explicitly set fields to null/None

            let tb = Self::TABLE;
            let mut query = String::from("UPSERT $__record_id SET ");
            let mut assign_clauses = Vec::new();
            let mut bind_values = Vec::new();
            
            // Получить список Option полей для правильного выбора NONE/null
            let option_fields: std::collections::HashSet<&str> = Self::get_option_fields().iter().copied().collect();
            
            for (key, v) in map.iter() {
                if v.is_null() {
                    // Для Option<T> полей используем NONE, для остальных - null
                    let literal = if option_fields.contains(key.as_str()) { "NONE" } else { "null" };
                    assign_clauses.push(format!("{} = {}", key, literal));
                } else {
                    assign_clauses.push(format!("{} = ${}", key, key));
                    bind_values.push((key.clone(), v.clone()));
                }
            }
            
            // 2. Поля, которых нет в JSON (Serde их скипнул через skip_serializing_if для flexible полей)
            // Их нужно явно установить в NONE/null в базе
            for &field_name in Self::get_fields() {
                if field_name != "id" && !map.contains_key(field_name) {
                    let literal = if option_fields.contains(field_name) { "NONE" } else { "null" };
                    assign_clauses.push(format!("{} = {}", field_name, literal));
                }
            }

            query.push_str(&assign_clauses.join(", "));

            let mut db_query = db.query(query).bind(("__record_id", surrealdb::types::RecordId::new(tb, actual_id)));
            
            // Bind только не-null значения
            for (k, v) in bind_values {
                if let Some(s) = v.as_str() {
                    let parts: Vec<&str> = s.split(':').collect();
                    if parts.len() == 2 && !s.contains(' ') && !s.contains('{') {
                        // Bind as RecordId
                        db_query = db_query.bind((k.as_str(), surrealdb::types::RecordId::new(parts[0], parts[1])));
                    } else {
                        db_query = db_query.bind((k.as_str(), v.clone()));
                    }
                } else {
                    db_query = db_query.bind((k.as_str(), v.clone()));
                }
            }

                        let mut res = db_query.await?;
            // UPSERT всегда возвращает ровно одну запись — defensive match удалён.
            let items: Vec<serde_json::Value> = res.take(0)?;
            let saved_val = items
                .into_iter()
                .next()
                .expect("UPSERT must return the saved record");
            Ok(serde_json::from_value(saved_val).unwrap())
        } else {
            Self::create(db, entity.clone()).await
        }
    }

    #[allow(async_fn_in_trait)]
    async fn delete<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, id: &str) -> Result<(), surrealdb::Error> {
        let parts: Vec<&str> = id.split(':').collect();
        if parts.len() == 2 && parts[0] != Self::TABLE {
            return Ok(());
        }
                        let actual_id = if parts.len() == 2 { parts[1] } else { id };
        // Отсутствующая таблица/запись → NotFound → идемпотентный Ok.
        match db.delete((Self::TABLE, actual_id)).await {
            Ok(_) => Ok(()),
            Err(e) => {
                if is_not_found(&e) {
                    Ok(())
                } else {
                    Err(e)
                }
            }
        }
    }
}
