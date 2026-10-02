//! Single Character Journey query and assembly.

use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{
    CharacterJourneyDto, JourneyAppearanceDto, JourneyEventDto, JourneyPromiseDto,
    JourneyRelationDto,
};
use worldwiki_domain::errors::DomainError;

#[derive(serde::Deserialize)]
struct JourneyRaw {
    entity: Option<RawJourneyEntityInfo>,
    #[serde(default)]
    appearances: Vec<JourneyAppearanceDto>,
    #[serde(default)]
    events: Vec<JourneyEventDto>,
    #[serde(default)]
    relations: Vec<JourneyRelationDto>,
    #[serde(default)]
    promises: Vec<JourneyPromiseDto>,
}

#[derive(serde::Deserialize)]
struct RawJourneyEntityInfo {
    id: String,
    name: String,
    entity_type: String,
    #[serde(default)]
    attributes: serde_json::Value,
}

pub(crate) async fn get_character_journey_impl(
    db: &Surreal<Db>,
    project_id: &str,
    entity_id: &str,
) -> Result<CharacterJourneyDto, DomainError> {
    let proj_clean = project_id.trim_start_matches("projects:");
    let ent_clean = entity_id.trim_start_matches("entities:");
    let sql = "RETURN fn::get_character_journey(type::record('projects', $p), type::record('entities', $e));";
    let mut res = db
        .query(sql)
        .bind(("p", proj_clean.to_string()))
        .bind(("e", ent_clean.to_string()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let raw: Option<JourneyRaw> = crate::surrealdb::repos::helpers::take_one(&mut res, 0)?;

    let raw = raw.unwrap_or(JourneyRaw {
        entity: None,
        appearances: vec![],
        events: vec![],
        relations: vec![],
        promises: vec![],
    });

    let (ent_id, ent_name, ent_type, ent_attrs) = if let Some(info) = raw.entity {
        (info.id, info.name, info.entity_type, info.attributes)
    } else {
        (
            entity_id.to_string(),
            "Unknown".to_string(),
            "character".to_string(),
            serde_json::json!({}),
        )
    };

    Ok(CharacterJourneyDto {
        entity_id: ent_id,
        entity_name: ent_name,
        entity_type: ent_type,
        attributes: ent_attrs,
        appearances: raw.appearances,
        events: raw.events,
        relations: raw.relations,
        promises: raw.promises,
    })
}
