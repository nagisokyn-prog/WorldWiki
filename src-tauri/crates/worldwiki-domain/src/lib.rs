pub mod ai;
pub mod analytics;
pub mod calendar;
pub mod document;
pub mod errors;
pub mod knowledge;
pub mod manuscript;
pub mod plot;
pub mod storage;

pub use errors::DomainError;

#[cfg(test)]
mod tests {
    use crate::analytics::{ContradictionAnomaly, ContradictionRule, ContradictionSeverity};
    use crate::calendar::{EventReveal, TimelineEvent};
    use crate::knowledge::Entity;
    use crate::manuscript::{AppearanceSource, Chapter, EntityAppearance, ManuscriptStatus, TextBlock};
    use crate::plot::{ArcType, Plan, PlanParentType, PlotPromise, PromiseKind, PromiseStatus, StoryArc};

    #[test]
    fn test_analytics_and_timeline_creation() {
        let ev = TimelineEvent::new("proj_1", "cal_1", "Затмение", 500);
        assert_eq!(ev.title, "Затмение");
        assert_eq!(ev.m_abs, 500);

        let anomaly = ContradictionAnomaly {
            rule: ContradictionRule::DeceasedEntityActive,
            severity: ContradictionSeverity::Critical,
            title: "Конфликт".to_string(),
            description: "Описание".to_string(),
            entity_ids: vec!["ent_1".to_string()],
            chapter_ids: vec![],
            event_ids: vec![ev.id.clone()],
            promise_ids: vec![],
        };
        assert_eq!(anomaly.severity, ContradictionSeverity::Critical);
    }

    #[test]
    fn test_extract_entity_mentions() {
        let text = "Встретились ((Алиса)) и ((Боб)), а потом пришел ((Алиса)).";
        let mentions = TextBlock::extract_entity_mentions(text);
        assert_eq!(mentions, vec!["Алиса", "Боб"]);
    }

    #[test]
    fn test_chapter_word_count_update() {
        let mut chapter = Chapter::new("proj_1", "Глава 1", 1);
        assert_eq!(chapter.word_count, 0);
        chapter.update_content("Один два три четыре пять".to_string());
        assert_eq!(chapter.word_count, 5);
        assert_eq!(chapter.status, ManuscriptStatus::Draft);
    }

    #[test]
    fn test_plot_promise_resolution() {
        let mut promise = PlotPromise::new(
            "proj_1",
            "ch_1",
            PromiseKind::Gun,
            "Старинный револьвер на стене",
        );
        assert_eq!(promise.status, PromiseStatus::Planted);
        promise.resolve(
            "ch_5",
            Some("vol_1".to_string()),
            Some(serde_json::json!("Выстрелил в финале")),
        );
        assert_eq!(promise.status, PromiseStatus::Resolved);
        assert_eq!(promise.resolved_in_chapter.as_deref(), Some("ch_5"));
    }

    #[test]
    fn test_story_arc_creation() {
        let arc = StoryArc::new("proj_1", "Поиск Грааля", ArcType::Theme);
        assert_eq!(arc.title, "Поиск Грааля");
        assert_eq!(arc.arc_type, ArcType::Theme);
        assert_eq!(arc.status, crate::plot::ArcStatus::Planned);
    }

    #[test]
    fn test_appearance_creation() {
        let app = EntityAppearance::new("ent_1", "ch_1", AppearanceSource::Mention);
        assert_eq!(app.source, AppearanceSource::Mention);
        assert_eq!(app.entity_id, "ent_1");
    }

    #[test]
    fn test_event_reveal_creation() {
        let rev = EventReveal::new("ev_1", "ch_2", "flashback");
        assert_eq!(rev.kind, "flashback");
        assert_eq!(rev.event_id, "ev_1");
    }

    #[test]
    fn test_plan_completion() {
        let mut plan = Plan::new(
            "proj_1",
            "Побег из замка",
            PlanParentType::Chapter,
            Some("ch_1".to_string()),
            1,
        );
        assert!(!plan.completed);
        plan.complete();
        assert!(plan.completed);
    }

    #[test]
    fn test_entity_creation() {
        let entity = Entity::new("proj_1", "character", "Элронд");
        assert_eq!(entity.name, "Элронд");
        assert_eq!(entity.type_key, "character");
    }
}

