pub mod errors;
pub mod manuscript;
pub mod knowledge;
pub mod calendar;
pub mod plot;
pub mod document;
pub mod ai;
pub mod storage;

pub use errors::DomainError;

#[cfg(test)]
mod tests {
    use crate::manuscript::{Chapter, TextBlock, ManuscriptStatus};
    use crate::plot::{PlotPromise, PromiseKind, PromiseStatus, Plan, PlanParentType};
    use crate::knowledge::Entity;

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
        let mut promise = PlotPromise::new("proj_1", "ch_1", PromiseKind::Gun, "Старинный револьвер на стене");
        assert_eq!(promise.status, PromiseStatus::Planted);
        promise.resolve("ch_5".to_string(), Some("vol_1".to_string()), None, Some("Выстрелил в финале".to_string()));
        assert_eq!(promise.status, PromiseStatus::Resolved);
        assert_eq!(promise.resolved_in_chapter.as_deref(), Some("ch_5"));
    }

    #[test]
    fn test_plan_completion() {
        let mut plan = Plan::new("proj_1", "Побег из замка", PlanParentType::Chapter, Some("ch_1".to_string()), 1);
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
