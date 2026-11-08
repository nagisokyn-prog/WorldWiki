use super::errors::ChapterError;
use crate::logic::models::Chapter;
use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};

pub async fn get_global_timeline_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<Value, ChapterError> {
    let chapters = super::crud::get_chapters_inner(db, project).await?;
    Ok(json!(chapters))
}

pub async fn save_global_timeline_inner(
    db: &Surreal<Db>,
    project: &str,
    data: Value,
) -> Result<Value, ChapterError> {
    Chapter::save_global_timeline_inner(db, project, data).await
}

impl Chapter {
    pub async fn save_global_timeline_inner(
        db: &Surreal<Db>,
        project: &str,
        data: Value,
    ) -> Result<Value, ChapterError> {
        let arr = data.as_array().ok_or_else(|| {
            ChapterError::InvalidData(
                "save_global_timeline: expected a JSON array of chapter timelines".to_string(),
            )
        })?;

        if arr.is_empty() {
            return Ok(json!({ "success": true, "updated": 0 }));
        }

        let clean_pid = project.trim().replace("projects:", "");
        let mut clean_items: Vec<Value> = Vec::new();

        for (i, item) in arr.iter().enumerate() {
            let cid = item
                .get("chapter_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    ChapterError::InvalidData(
                        "save_global_timeline: each item must have chapter_id".to_string(),
                    )
                })?;
            let title = item
                .get("chapter_title")
                .and_then(|v| v.as_str())
                .map(|t| t.to_string())
                .unwrap_or_else(|| format!("chapter-{i}"));
            let clean_cid = cid.trim().replace("chapters:", "");

            let events = item.get("events").cloned().unwrap_or(Value::Array(vec![]));
            let participants = item
                .get("participants")
                .cloned()
                .unwrap_or(Value::Array(vec![]));

            clean_items.push(json!({
                "chapter_id": clean_cid,
                "title": title,
                "events": events,
                "participants": participants,
            }));
        }

        let mut res = db
            .query("fn::save_global_timeline(type::record('projects', $p), $items);")
            .bind(("p", clean_pid))
            .bind(("items", clean_items))
            .await?;

        let errs = res.take_errors();
        if !errs.is_empty() {
            return Err(ChapterError::Transaction(
                errs.into_values()
                    .next()
                    .map(|e| e.to_string())
                    .unwrap_or_else(|| "save_global_timeline: unknown error".to_string()),
            ));
        }

        Ok(json!({ "success": true, "updated": arr.len() }))
    }
}

/// Получить бандл планет и календарей для проекта через хранимую функцию SurrealDB
pub async fn get_planet_calendar_bundle_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<Value, ChapterError> {
    let clean_pid = project.trim().replace("projects:", "");
    eprintln!("[DEBUG][get_planet_calendar_bundle] >>> project={:?}, clean_pid={:?}", project, clean_pid);

    // Diagnostic query: dump existing planets and calendars from DB
    if let Ok(mut diag) = db.query("SELECT id, name, project_id, type::string(project_id) AS pid_str FROM planets; SELECT id, name, planet_id, planet_id.project_id AS pl_proj, type::string(planet_id.project_id) AS pl_proj_str FROM calendars;").await {
        let all_planets: Vec<Value> = diag.take(0).unwrap_or_default();
        let all_cals: Vec<Value> = diag.take(1).unwrap_or_default();
        eprintln!("[DEBUG][DB_DUMP] All Planets in DB (count={}):", all_planets.len());
        for p in &all_planets {
            eprintln!("   -> Planet id={}, name={}, project_id={}", p["id"], p["name"], p["pid_str"]);
        }
        eprintln!("[DEBUG][DB_DUMP] All Calendars in DB (count={}):", all_cals.len());
        for c in &all_cals {
            eprintln!("   -> Cal id={}, name={}, planet_id={}, planet_id.project_id={}", c["id"], c["name"], c["planet_id"], c["pl_proj_str"]);
        }
    }

    let mut res = db
        .query("RETURN fn::get_planet_calendar_bundle(type::record('projects', $p));")
        .bind(("p", clean_pid.clone()))
        .await?;
    let val: Option<Value> = res.take(0)?;
    if let Some(ref v) = val {
        let pl_count = v.get("planets").and_then(|p| p.as_array()).map(|a| a.len()).unwrap_or(0);
        let cal_count = v.get("calendars").and_then(|c| c.as_array()).map(|a| a.len()).unwrap_or(0);
        eprintln!("[DEBUG][get_planet_calendar_bundle] <<< bundle for {:?}: planets_count={}, calendars_count={}", clean_pid, pl_count, cal_count);
        if let Some(cals) = v.get("calendars").and_then(|c| c.as_array()) {
            for c in cals {
                eprintln!("   [bundle cal] id={}, name={}, planet_id={}, is_master={}", c["id"], c["name"], c["planet_id"], c["is_master"]);
            }
        }
    } else {
        eprintln!("[DEBUG][get_planet_calendar_bundle] <<< returning None for {:?}", clean_pid);
    }
    Ok(val.unwrap_or(json!({ "planets": [], "calendars": [] })))
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct SavePlanetParams {
    pub project: String,
    pub planet_id: Option<String>,
    pub name: String,
    pub ticks_per_day: i64,
    pub axial_tilt_mdeg: Option<i64>,
    pub orbit_days_num: Option<i64>,
    pub orbit_days_den: Option<i64>,
    pub moons: Option<Value>,
    pub timezones: Option<Value>,
    pub regions: Option<Value>,
}

/// Сохранить планету через хранимую функцию SurrealDB
pub async fn save_planet_inner(
    db: &Surreal<Db>,
    params: SavePlanetParams,
) -> Result<Value, ChapterError> {
    let clean_pid = params.project.trim().replace("projects:", "");
    eprintln!("[DEBUG][save_planet] params: project={:?}, clean_pid={:?}, planet_id={:?}, name={:?}", params.project, clean_pid, params.planet_id, params.name);
    let id_clause = if let Some(ref pid) = params.planet_id {
        format!("type::record('planets', '{}')", pid.trim().replace("planets:", ""))
    } else {
        "NONE".to_string()
    };
    let query_str = format!(
        "RETURN fn::save_planet({}, type::record('projects', $p), $name, $ticks, $tilt, $num, $den, $moons, $timezones, $regions);",
        id_clause
    );

    crate::with_occ_retry!(4, 50, async {
        let mut res = db
            .query(&query_str)
            .bind(("p", clean_pid.clone()))
            .bind(("name", params.name.clone()))
            .bind(("ticks", params.ticks_per_day))
            .bind(("tilt", params.axial_tilt_mdeg))
            .bind(("num", params.orbit_days_num))
            .bind(("den", params.orbit_days_den))
            .bind(("moons", params.moons.clone()))
            .bind(("timezones", params.timezones.clone()))
            .bind(("regions", params.regions.clone()))
            .await?;

        let errs = res.take_errors();
        if !errs.is_empty() {
            let err_msg = errs.into_values().next().map(|e| e.to_string()).unwrap_or_default();
            eprintln!("[DEBUG][save_planet] ERR: {}", err_msg);
            return Err(ChapterError::Transaction(err_msg));
        }

        let val: Option<Value> = res.take(0)?;
        if let Some(ref v) = val {
            eprintln!("[DEBUG][save_planet] SUCCESS: id={}, name={}", v["id"], v["name"]);
        } else {
            eprintln!("[DEBUG][save_planet] SUCCESS");
        }
        Ok(val.unwrap_or(json!({ "success": true })))
    })
}

/// Сохранить календарь через хранимую функцию SurrealDB
pub async fn save_calendar_inner(
    db: &Surreal<Db>,
    project: &str,
    calendar_id: Option<String>,
    planet_id: &str,
    name: &str,
    is_master: bool,
    data: Value,
) -> Result<Value, ChapterError> {
    let clean_pid = project.trim().replace("projects:", "");
    let raw_plid = planet_id.trim().replace("planets:", "");
    eprintln!("[DEBUG][save_calendar] project={:?}, clean_pid={:?}, cal_id={:?}, planet_id={:?}, raw_plid={:?}, name={:?}, is_master={}", project, clean_pid, calendar_id, planet_id, raw_plid, name, is_master);
    let plid_clause = if raw_plid.is_empty() || raw_plid == "NONE" {
        "NONE".to_string()
    } else {
        format!("type::record('planets', '{}')", raw_plid)
    };
    let id_clause = if let Some(ref cid) = calendar_id {
        format!("type::record('calendars', '{}')", cid.trim().replace("calendars:", ""))
    } else {
        "NONE".to_string()
    };
    let query_str = format!(
        "RETURN fn::save_calendar({}, type::record('projects', $p), {}, $name, $is_master, $data);",
        id_clause, plid_clause
    );

    crate::with_occ_retry!(4, 50, async {
        let mut res = db
            .query(&query_str)
            .bind(("p", clean_pid.clone()))
            .bind(("name", name.to_string()))
            .bind(("is_master", is_master))
            .bind(("data", data.clone()))
            .await?;

        let errs = res.take_errors();
        if !errs.is_empty() {
            let err_msg = errs.into_values().next().map(|e| e.to_string()).unwrap_or_default();
            eprintln!("[DEBUG][save_calendar] ERR: {}", err_msg);
            return Err(ChapterError::Transaction(err_msg));
        }

        let val: Option<Value> = res.take(0)?;
        if let Some(ref v) = val {
            eprintln!("[DEBUG][save_calendar] SUCCESS: id={}, name={}", v["id"], v["name"]);
        } else {
            eprintln!("[DEBUG][save_calendar] SUCCESS");
        }
        Ok(val.unwrap_or(json!({ "success": true })))
    })
}

/// Назначить мастер-календарь проекта через хранимую функцию SurrealDB
pub async fn set_master_calendar_inner(
    db: &Surreal<Db>,
    project: &str,
    planet_id: &str,
    calendar_id: &str,
) -> Result<Value, ChapterError> {
    let clean_pid = project.trim().replace("projects:", "");
    let raw_plid = planet_id.trim().replace("planets:", "");
    if raw_plid.is_empty() || raw_plid == "NONE" {
        return Ok(json!({ "success": false, "error": "Invalid planet ID" }));
    }
    let clean_plid = raw_plid;
    let clean_cid = calendar_id.trim().replace("calendars:", "");
    let mut res = db
        .query("RETURN fn::set_master_calendar(type::record('projects', $p), type::record('planets', $plid), type::record('calendars', $cid));")
        .bind(("p", clean_pid))
        .bind(("plid", clean_plid))
        .bind(("cid", clean_cid))
        .await?;
    let val: Option<Value> = res.take(0)?;
    Ok(val.unwrap_or(json!({ "success": true })))
}

/// Удалить планету через хранимую функцию SurrealDB
pub async fn delete_planet_inner(
    db: &Surreal<Db>,
    project: &str,
    planet_id: &str,
    cascade: bool,
) -> Result<Value, ChapterError> {
    let clean_pid = project.trim().replace("projects:", "");
    let raw_plid = planet_id.trim().replace("planets:", "");
    if raw_plid.is_empty() || raw_plid == "NONE" {
        return Ok(json!({ "success": false, "error": "Invalid planet ID" }));
    }
    let clean_plid = raw_plid;
    let mut res = db
        .query("RETURN fn::delete_planet(type::record('projects', $p), type::record('planets', $plid), $cascade);")
        .bind(("p", clean_pid))
        .bind(("plid", clean_plid))
        .bind(("cascade", cascade))
        .await?;
    let val: Option<Value> = res.take(0)?;
    Ok(val.unwrap_or(json!({ "success": true })))
}

/// Удалить календарь через хранимую функцию SurrealDB
pub async fn delete_calendar_inner(
    db: &Surreal<Db>,
    calendar_id: &str,
) -> Result<Value, ChapterError> {
    let clean_cid = calendar_id.trim().replace("calendars:", "");
    let mut res = db
        .query("RETURN fn::delete_calendar(type::record('calendars', $cid));")
        .bind(("cid", clean_cid))
        .await?;
    let val: Option<Value> = res.take(0)?;
    Ok(val.unwrap_or(json!({ "success": true })))
}


