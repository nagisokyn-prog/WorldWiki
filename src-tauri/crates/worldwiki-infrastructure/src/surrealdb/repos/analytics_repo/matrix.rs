//! Matrix and cross-reference analytics methods.

use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{
    AbsenceWarningDto, CellAppearanceDto, CellAppearanceKind, ChapterHeaderDto, CrossRefMatrixDto,
    EntityRowDto,
};
use worldwiki_domain::errors::DomainError;

#[derive(serde::Deserialize)]
pub(crate) struct RawChapterHeader {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub sort_order: Option<i32>,
    #[serde(default)]
    pub word_count: Option<i32>,
}

impl RawChapterHeader {
    pub(crate) fn into_dto(self) -> ChapterHeaderDto {
        ChapterHeaderDto {
            id: self.id,
            title: self.title,
            sort_order: self.sort_order.unwrap_or(0),
            word_count: self.word_count.unwrap_or(0),
        }
    }
}

#[derive(serde::Deserialize)]
struct CrossRefRaw {
    chapters: Vec<RawChapterHeader>,
    entities: Vec<RawEntityRow>,
}

#[derive(serde::Deserialize)]
struct RawEntityRow {
    id: String,
    name: String,
    entity_type: String,
    #[serde(default)]
    is_deceased: Option<bool>,
    #[serde(default)]
    death_m_abs: Option<i64>,
    #[serde(default)]
    birth_m_abs: Option<i64>,
    #[serde(default)]
    role_in_story: Option<String>,
    #[serde(default)]
    status_category: Option<String>,
    #[serde(default)]
    appearances: Vec<RawAppearanceEdge>,
}

#[derive(serde::Deserialize)]
struct RawAppearanceEdge {
    chapter_id: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    role: Option<String>,
}

fn build_entity_appearances(
    ent: &RawEntityRow,
    chapters: &[RawChapterHeader],
) -> (Vec<CellAppearanceDto>, i32, bool) {
    let mut apps_by_chap = Vec::with_capacity(chapters.len());
    let mut last_seen_order = 0;
    let mut appeared_in_any = false;

    for ch in chapters {
        let found_app = ent.appearances.iter().find(|a| {
            a.chapter_id == ch.id
                || a.chapter_id.trim_start_matches("chapters:")
                    == ch.id.trim_start_matches("chapters:")
        });

        let ch_order = ch.sort_order.unwrap_or(0);

        let (kind, src, role) = if ent.is_deceased.unwrap_or(false) && ent.death_m_abs.is_some() {
            (CellAppearanceKind::Deceased, None, None)
        } else if let Some(app) = found_app {
            appeared_in_any = true;
            last_seen_order = ch_order;
            let k = if app.source.as_deref() == Some("scene") {
                CellAppearanceKind::Scene
            } else {
                CellAppearanceKind::Mention
            };
            (k, app.source.clone(), app.role.clone())
        } else {
            (CellAppearanceKind::None, None, None)
        };

        apps_by_chap.push(CellAppearanceDto {
            chapter_id: ch.id.clone(),
            kind,
            source: src,
            role,
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
            entity_name: ent.name.clone(),
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
    let proj_clean = project_id.trim_start_matches("projects:");
    let sql = "RETURN fn::get_cross_reference_matrix(type::record('projects', $p));";
    let mut res = db
        .query(sql)
        .bind(("p", proj_clean.to_string()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let raw: Option<CrossRefRaw> = crate::surrealdb::repos::helpers::take_one(&mut res, 0)?;
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
            name: ent.name,
            entity_type: ent.entity_type,
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
