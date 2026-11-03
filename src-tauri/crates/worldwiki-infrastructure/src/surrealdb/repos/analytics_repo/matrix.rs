//! Matrix and cross-reference analytics methods.

use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::analytics::{
    AbsenceWarningDto, CellAppearanceDto, CellAppearanceKind, ChapterHeaderDto, CrossRefMatrixDto,
    EntityRowDto,
};
use worldwiki_domain::errors::DomainError;

#[derive(serde::Deserialize)]
pub(crate) struct RawChapterHeader {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub volume_id: Option<String>,
    #[serde(default)]
    pub volume_title: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i32>,
    #[serde(default)]
    pub word_count: Option<i32>,
}

impl RawChapterHeader {
    pub(crate) fn into_dto(self) -> ChapterHeaderDto {
        ChapterHeaderDto {
            id: self.id,
            title: self.title.unwrap_or_default(),
            volume_id: self.volume_id,
            volume_title: self.volume_title,
            sort_order: self.sort_order.unwrap_or(0),
            word_count: self.word_count.unwrap_or(0),
        }
    }
}

#[derive(serde::Deserialize)]
struct CrossRefRaw {
    #[serde(default)]
    chapters: Vec<RawChapterHeader>,
    #[serde(default)]
    entities: Vec<RawEntityRow>,
}

#[derive(serde::Deserialize)]
struct RawEntityRow {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub entity_type: Option<String>,
    #[serde(default)]
    pub is_deceased: Option<bool>,
    #[serde(default)]
    pub death_m_abs: Option<i64>,
    #[serde(default)]
    pub birth_m_abs: Option<i64>,
    #[serde(default)]
    pub role_in_story: Option<String>,
    #[serde(default)]
    pub status_category: Option<String>,
    #[serde(default)]
    pub appearances: Vec<RawAppearanceEdge>,
}

#[derive(serde::Deserialize)]
struct RawAppearanceEdge {
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
}

fn build_entity_appearances(
    ent: &RawEntityRow,
    chapters: &[RawChapterHeader],
) -> (Vec<CellAppearanceDto>, i32, bool) {
    let mut apps_by_chap = Vec::with_capacity(chapters.len());
    let mut last_seen_order = 0;
    let mut appeared_in_any = false;

    let mut active_chap_orders = Vec::new();
    for a in &ent.appearances {
        if let Some(ch_id) = &a.chapter_id {
            let clean = ch_id.trim_start_matches("chapters:");
            if let Some(ch) = chapters
                .iter()
                .find(|c| c.id.trim_start_matches("chapters:") == clean)
            {
                active_chap_orders.push(ch.sort_order.unwrap_or(0));
            }
        }
    }
    let max_active_order = active_chap_orders.into_iter().max().unwrap_or(0);

    for ch in chapters {
        let ch_id_clean = ch.id.trim_start_matches("chapters:");
        let ch_order = ch.sort_order.unwrap_or(0);

        let matching_apps: Vec<&RawAppearanceEdge> = ent
            .appearances
            .iter()
            .filter(|a| {
                if let Some(ch_id) = &a.chapter_id {
                    let clean = ch_id.trim_start_matches("chapters:");
                    clean == ch_id_clean
                } else {
                    false
                }
            })
            .collect();

        let has_scene = matching_apps
            .iter()
            .any(|a| a.source.as_deref() == Some("scene") || a.source.as_deref() == Some("manual"));
        let has_mention = matching_apps
            .iter()
            .any(|a| a.source.as_deref() == Some("mention") || a.source.is_none());
        let count = matching_apps.len() as i32;

        let (kind, src, role) = if has_scene || has_mention {
            appeared_in_any = true;
            if ch_order > last_seen_order {
                last_seen_order = ch_order;
            }
            let k = if has_scene && has_mention {
                CellAppearanceKind::Both
            } else if has_scene {
                CellAppearanceKind::Scene
            } else {
                CellAppearanceKind::Mention
            };
            let primary_src = if has_scene {
                Some("scene".to_string())
            } else {
                Some("mention".to_string())
            };
            let primary_role = matching_apps.iter().find_map(|a| a.role.clone());
            (k, primary_src, primary_role)
        } else if ent.is_deceased.unwrap_or(false)
            && (max_active_order == 0 || ch_order > max_active_order)
        {
            (CellAppearanceKind::Deceased, None, None)
        } else {
            (CellAppearanceKind::None, None, None)
        };

        apps_by_chap.push(CellAppearanceDto {
            chapter_id: ch.id.clone(),
            kind,
            source: src,
            role,
            has_scene,
            has_mention,
            count,
        });
    }

    (apps_by_chap, last_seen_order, appeared_in_any)
}

fn check_absence_warning(
    ent: &RawEntityRow,
    chapters: &[RawChapterHeader],
    last_seen_order: i32,
    appeared_in_any: bool,
) -> Option<AbsenceWarningDto> {
    if !appeared_in_any || chapters.is_empty() {
        return None;
    }
    let latest_order = chapters.last().and_then(|c| c.sort_order).unwrap_or(0);
    let gap = (latest_order - last_seen_order) as usize;
    if gap >= 3 {
        let missing_since_chapter_id = chapters
            .iter()
            .find(|c| c.sort_order.unwrap_or(0) == last_seen_order)
            .map(|c| c.id.clone())
            .unwrap_or_default();

        Some(AbsenceWarningDto {
            entity_id: ent.id.clone(),
            entity_name: ent.name.clone().unwrap_or_default(),
            missing_since_chapter_id,
            missing_since_order: last_seen_order,
            skipped_chapters_count: gap,
        })
    } else {
        None
    }
}

pub(crate) async fn get_cross_reference_matrix_impl(
    db: &Surreal<Db>,
    project_id: &str,
) -> Result<CrossRefMatrixDto, DomainError> {
    let proj_clean = clean_raw_id!(project_id, "projects");
    let sql = "RETURN fn::get_cross_reference_matrix(type::record('projects', $p));";
    let raw: Option<CrossRefRaw> = surreal_take_one!(db, sql, ("p", proj_clean))?;
    let raw = raw.unwrap_or(CrossRefRaw {
        chapters: vec![],
        entities: vec![],
    });

    let mut entities_dto = Vec::with_capacity(raw.entities.len());
    let mut warnings = Vec::new();

    for ent in raw.entities {
        let (apps_by_chap, last_seen_order, appeared_in_any) =
            build_entity_appearances(&ent, &raw.chapters);

        if let Some(warning) =
            check_absence_warning(&ent, &raw.chapters, last_seen_order, appeared_in_any)
        {
            warnings.push(warning);
        }

        entities_dto.push(EntityRowDto {
            id: ent.id,
            name: ent.name.unwrap_or_default(),
            entity_type: ent.entity_type.unwrap_or_else(|| "character".to_string()),
            is_deceased: ent.is_deceased.unwrap_or(false),
            death_m_abs: ent.death_m_abs,
            birth_m_abs: ent.birth_m_abs,
            role_in_story: ent.role_in_story,
            status_category: ent.status_category,
            appearances_by_chapter: apps_by_chap,
        });
    }

    Ok(CrossRefMatrixDto {
        chapters: raw.chapters.into_iter().map(|c| c.into_dto()).collect(),
        entities: entities_dto,
        absence_warnings: warnings,
    })
}
