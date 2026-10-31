use worldwiki_domain::manuscript::Chapter;
use crate::error::IpcError;
use crate::bridge_command;

bridge_command!(
    get_chapter(chapter_id: String) -> Result<Chapter, IpcError>
        => manuscript.get_chapter(&chapter_id)
);

bridge_command!(
    save_chapter(chapter: Chapter) -> Result<(), IpcError>
        => manuscript.save_chapter(&chapter)
);
