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
    use crate::calendar::{EventReveal, TimelineEvent};
    use crate::knowledge::Entity;
    use crate::manuscript::{AppearanceSource, Chapter, EntityAppearance, TextBlock};
    use crate::plot::{PlotPromise, PromiseKind, PromiseStatus, StoryArc, Todo};

    #[test]
    fn test_analytics_and_timeline_creation() {
        let ev = TimelineEvent::new("proj_1", "cal_1", "Затмение", 500);
        assert_eq!(ev.title, "Затмение");
        assert_eq!(ev.m_abs, 500);
    }

    #[test]
    fn test_extract_entity_mentions() {
        let text = "Встретились ((Алиса)) и ((Боб)), а потом пришел ((Алиса)).";
        let mentions = TextBlock::extract_entity_mentions(text);
        assert_eq!(mentions, vec!["Алиса", "Боб"]);
    }

    #[test]
    fn test_chapter_word_count_update() {
        let mut chapter = Chapter::new("vol_1", "Глава 1", 1);
        assert_eq!(chapter.word_count, 0);
        chapter.update_content("Один два три четыре пять".to_string());
        assert_eq!(chapter.word_count, 5);
    }

    #[test]
    fn test_plot_promise_resolution() {
        let mut promise =
            PlotPromise::new("proj_1", PromiseKind::Gun, "Старинный револьвер на стене");
        assert_eq!(promise.status, PromiseStatus::Planted);
        promise.resolve();
        assert_eq!(promise.status, PromiseStatus::Resolved);
    }

    #[test]
    fn test_story_arc_creation() {
        let arc = StoryArc::new("proj_1", "Поиск Грааля");
        assert_eq!(arc.title, "Поиск Грааля");
        assert_eq!(arc.status, crate::plot::ArcStatus::InProgress);
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
    fn test_todo_toggle() {
        let mut todo = Todo::new("chapters:ch_1", "Побег из замка", 1);
        assert!(!todo.is_done);
        todo.toggle();
        assert!(todo.is_done);
    }

    #[test]
    fn test_entity_creation() {
        let entity = Entity::new("proj_1", "character", "Элронд");
        assert_eq!(entity.name, "Элронд");
        assert_eq!(entity.type_key, "character");
    }
}
