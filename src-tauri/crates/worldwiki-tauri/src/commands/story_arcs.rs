use worldwiki_domain::plot::{ArcChapterRelation, ArcEntityRelation, StoryArc};
use crate::error::IpcError;
use crate::bridge_command;

bridge_command!(
    get_story_arcs(project_id: String) -> Result<Vec<StoryArc>, IpcError>
        => story_arcs.list_by_project(&project_id)
);

bridge_command!(
    save_story_arc(arc: StoryArc) -> Result<String, IpcError>
        => story_arcs.save_arc(&arc)
);

bridge_command!(
    delete_story_arc(id: String) -> Result<(), IpcError>
        => story_arcs.delete_arc(&id)
);

bridge_command!(
    assign_arc_chapter(relation: ArcChapterRelation) -> Result<(), IpcError>
        => story_arcs.assign_chapter(&relation)
);

bridge_command!(
    remove_arc_chapter(
        arc_id: String,
        chapter_id: String,
    ) -> Result<(), IpcError>
        => story_arcs.remove_chapter(&arc_id, &chapter_id)
);

bridge_command!(
    assign_arc_entity(relation: ArcEntityRelation) -> Result<(), IpcError>
        => story_arcs.assign_entity(&relation)
);

bridge_command!(
    remove_arc_entity(
        arc_id: String,
        entity_id: String,
    ) -> Result<(), IpcError>
        => story_arcs.remove_entity(&arc_id, &entity_id)
);

bridge_command!(
    get_arc_chapters(arc_id: String) -> Result<Vec<ArcChapterRelation>, IpcError>
        => story_arcs.list_chapters_for_arc(&arc_id)
);

bridge_command!(
    get_arc_entities(arc_id: String) -> Result<Vec<ArcEntityRelation>, IpcError>
        => story_arcs.list_entities_for_arc(&arc_id)
);
