use std::collections::HashSet;
use worldwiki_domain::analytics::{JourneyParticipantArcDto, JourneyParticipantDto};
use worldwiki_domain::errors::OptionStrExt;

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawEntity {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub attributes: serde_json::Value,
}

#[derive(Debug, Clone)]
pub(crate) struct MultiJourneyCleanEntity {
    pub id: String,
    pub name: String,
    pub attributes: serde_json::Value,
}

impl MultiJourneyRawEntity {
    pub(crate) fn clean(self) -> MultiJourneyCleanEntity {
        MultiJourneyCleanEntity {
            id: self.id.unwrap_or_default(),
            name: self.name.unwrap_or_str("Без имени"),
            attributes: self.attributes,
        }
    }
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawAppearance {
    #[serde(default)]
    pub entity_id: Option<String>,
    #[serde(default)]
    pub entity_name: Option<String>,
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub chapter_title: Option<String>,
    #[serde(default)]
    pub volume_title: Option<String>,
    #[serde(default)]
    pub chapter_order: Option<i32>,
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct MultiJourneyCleanAppearance {
    pub entity_id: String,
    pub entity_name: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub volume_title: Option<String>,
    pub chapter_order: i32,
    pub role: Option<String>,
}

impl MultiJourneyRawAppearance {
    pub(crate) fn clean(self) -> MultiJourneyCleanAppearance {
        MultiJourneyCleanAppearance {
            entity_id: self.entity_id.unwrap_or_default(),
            entity_name: self.entity_name.unwrap_or_str("Без имени"),
            chapter_id: self.chapter_id.unwrap_or_default(),
            chapter_title: self.chapter_title.unwrap_or_str("Сцена"),
            volume_title: self.volume_title,
            chapter_order: self.chapter_order.unwrap_or(0),
            role: self.role,
        }
    }
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawPromise {
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub quote: Option<String>,
    #[serde(default)]
    pub block_id: Option<String>,
    #[serde(default)]
    pub paragraph_index: Option<i64>,
    #[serde(default)]
    pub arc_id: Option<String>,
    #[serde(default)]
    pub arc_title: Option<String>,
    #[serde(default)]
    pub arc_phase: Option<String>,
    #[serde(default)]
    pub arc_color: Option<String>,
    #[serde(default)]
    pub m_abs: Option<i64>,
    #[serde(default)]
    pub participant_ids: Option<Vec<String>>,
}

impl MultiJourneyRawPromise {
    fn to_arc_dto(&self) -> Option<JourneyParticipantArcDto> {
        let arc_id = self.arc_id.as_ref()?;
        let arc_title = self.arc_title.as_ref()?;
        Some(JourneyParticipantArcDto {
            arc_id: arc_id.clone(),
            arc_title: arc_title.clone(),
            arc_phase: self.arc_phase.clone(),
            color: self.arc_color.clone(),
        })
    }

    fn matches_participant(&self, part: &MultiJourneyCleanAppearance) -> bool {
        let Some(ids) = self.participant_ids.as_ref() else {
            return true;
        };
        let clean_ent_id = part.entity_id.trim_start_matches("entities:");
        for id in ids {
            if id == &part.entity_id || id == &part.entity_name || id == clean_ent_id {
                return true;
            }
        }
        false
    }
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawData {
    #[serde(default)]
    pub entities: Vec<MultiJourneyRawEntity>,
    #[serde(default)]
    pub appearances: Vec<MultiJourneyRawAppearance>,
    #[serde(default)]
    pub promises: Vec<MultiJourneyRawPromise>,
}

fn extract_participant_arcs(
    part: &MultiJourneyCleanAppearance,
    promises: &[&MultiJourneyRawPromise],
) -> Vec<JourneyParticipantArcDto> {
    let mut arcs_set = HashSet::new();
    let mut arcs = Vec::new();

    for p in promises {
        if p.matches_participant(part)
            && let Some(arc_id) = p.arc_id.as_deref()
            && arcs_set.insert(arc_id)
            && let Some(dto) = p.to_arc_dto()
        {
            arcs.push(dto);
        }
    }
    arcs
}

fn calculate_diegetic_age(birth_m_abs: Option<i64>, scene_m_abs: Option<i64>) -> Option<String> {
    match (birth_m_abs, scene_m_abs) {
        (Some(birth), Some(scene)) if scene >= birth => {
            let delta_min = scene - birth;
            let years = delta_min / 525_600;
            if years > 0 {
                Some(format!("{} лет", years))
            } else {
                Some("Младше года".to_string())
            }
        }
        (Some(_), Some(_)) => Some("До рождения".to_string()),
        _ => None,
    }
}

pub(super) fn build_participant_dto(
    part: &MultiJourneyCleanAppearance,
    ent_info: Option<&&MultiJourneyCleanEntity>,
    promises: &[&MultiJourneyRawPromise],
    scene_m_abs: Option<i64>,
) -> JourneyParticipantDto {
    let role_in_story = ent_info
        .and_then(|e| e.attributes.get("роль_в_истории"))
        .and_then(|v| v.as_str())
        .map(ToString::to_string)
        .or_else(|| part.role.clone());

    let status_category = ent_info
        .and_then(|e| e.attributes.get("статус_категория"))
        .and_then(|v| v.as_str())
        .map(ToString::to_string);

    let birth_m_abs = ent_info
        .and_then(|e| e.attributes.get("дата_рождения"))
        .and_then(|d| d.get("absolute_minute"))
        .and_then(|v| v.as_i64());

    let death_m_abs = ent_info
        .and_then(|e| e.attributes.get("дата_смерти"))
        .and_then(|d| d.get("absolute_minute"))
        .and_then(|v| v.as_i64());

    let is_before_birth = match (birth_m_abs, scene_m_abs) {
        (Some(birth), Some(scene)) => scene < birth,
        _ => false,
    };

    let is_deceased = status_category.as_deref() == Some("Мёртв")
        || match (death_m_abs, scene_m_abs) {
            (Some(death), Some(scene)) => scene > death,
            _ => false,
        };

    let age_label = calculate_diegetic_age(birth_m_abs, scene_m_abs);
    let arcs = extract_participant_arcs(part, promises);

    JourneyParticipantDto {
        entity_id: part.entity_id.clone(),
        entity_name: part.entity_name.clone(),
        role_in_story,
        status_category,
        age_label,
        is_before_birth,
        is_deceased,
        arcs,
    }
}
