use serde::{Deserialize, Serialize};

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

    fn get_id(&self) -> Option<String>;
    fn set_id(&mut self, id: String);

    #[allow(async_fn_in_trait)]
    async fn create<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, mut entity: Self) -> Result<Self, surrealdb::Error> {
        let mut val = serde_json::to_value(&entity).unwrap();
        if let Some(map) = val.as_object_mut() {
            map.remove("id");
        }
        let res: Option<serde_json::Value> = db.create(Self::TABLE)
            .content(val)
            .await?;
        if let Some(res_val) = res {
            let created: Self = serde_json::from_value(res_val).unwrap();
            entity.set_id(created.get_id().unwrap_or_default());
            Ok(created)
        } else {
            Err(surrealdb::Error::thrown("Failed to create entity".to_string()))
        }
    }

    #[allow(async_fn_in_trait)]
    async fn find_by_id<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, id: &str) -> Result<Option<Self>, surrealdb::Error> {
        let parts: Vec<&str> = id.split(':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id };
        let res: Option<serde_json::Value> = db.select((Self::TABLE, actual_id)).await?;
        Ok(res.and_then(|v| serde_json::from_value(v).ok()))
    }

    #[allow(async_fn_in_trait)]
    async fn find_all<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, project_id: &str) -> Result<Vec<Self>, surrealdb::Error> {
        let pid_raw = project_id.split(':').last().unwrap_or(project_id);
        let pid_str = format!("projects:{}", pid_raw);
        let mut res = db.query(format!("SELECT * FROM {} WHERE project_id = $pid OR project_id = type::record('projects', $pid_raw) OR project_id = $pid_str", Self::TABLE))
            .bind(("pid", project_id.to_string()))
            .bind(("pid_raw", pid_raw.to_string()))
            .bind(("pid_str", pid_str))
            .await?;
        let entities_opt_res: Result<Vec<serde_json::Value>, _> = res.take(0);
        match entities_opt_res {
            Ok(entities) => {
                let mapped = entities.into_iter()
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
                                        } else if let Some(s) = id_field.as_str() {
                                            s
                                        } else {
                                            ""
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
            Err(e) => {
                eprintln!("Error in find_all for table {}: {:?}", Self::TABLE, e);
                Err(e)
            }
        }
    }

    #[allow(async_fn_in_trait)]
    async fn save<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, entity: &Self) -> Result<Self, surrealdb::Error> {
        if let Some(id_str) = entity.get_id() {
            let parts: Vec<&str> = id_str.split(':').collect();
            let actual_id = if parts.len() == 2 { parts[1] } else { &id_str };
            
            let mut val = serde_json::to_value(entity).unwrap();
            if let Some(map) = val.as_object_mut() {
                map.remove("id");
            }
            
            let res: Option<serde_json::Value> = db.upsert((Self::TABLE, actual_id))
                .merge(val)
                .await?;
            if let Some(val) = res {
                Ok(serde_json::from_value(val).unwrap())
            } else {
                Self::create(db, entity.clone()).await
            }
        } else {
            Self::create(db, entity.clone()).await
        }
    }

    #[allow(async_fn_in_trait)]
    async fn delete<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, id: &str) -> Result<(), surrealdb::Error> {
        let parts: Vec<&str> = id.split(':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id };
        let _: Option<serde_json::Value> = db.delete((Self::TABLE, actual_id)).await?;
        Ok(())
    }
}
