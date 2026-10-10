pub mod commands;
pub mod crud;
pub mod errors;
pub mod revisions;
pub mod text_blocks;
pub mod timeline;

pub use commands::*;
pub use crud::*;
pub use errors::*;
pub use revisions::*;
pub use text_blocks::*;
pub use timeline::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chapter_error_formatting_and_conversion() {
        let not_found = ChapterError::NotFound("c1".to_string());
        assert_eq!(not_found.to_string(), "Chapter not found: c1");

        let err_str = not_found.to_string();
        assert_eq!(err_str, "Chapter not found: c1");

        let inv = ChapterError::InvalidData("bad json".to_string());
        assert_eq!(inv.to_string(), "Invalid chapter data: bad json");
    }
}
