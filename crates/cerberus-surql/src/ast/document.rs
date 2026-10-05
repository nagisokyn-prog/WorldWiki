use crate::ast::node::{SourceSpan, Statement};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct SurqlDocument {
    pub file_path: PathBuf,
    pub source: String,
    pub statements: Vec<Statement>,
    line_offsets: Vec<usize>,
}

impl SurqlDocument {
    pub fn new(source: String, file_path: PathBuf, statements: Vec<Statement>) -> Self {
        let mut line_offsets = vec![0];
        for (i, b) in source.bytes().enumerate() {
            if b == b'\n' {
                line_offsets.push(i + 1);
            }
        }
        Self {
            file_path,
            source,
            statements,
            line_offsets,
        }
    }

    pub fn resolve_span(&self, start_byte: usize, end_byte: usize) -> SourceSpan {
        let (start_line, start_col) = self.byte_to_line_col(start_byte);
        let (end_line, end_col) = self.byte_to_line_col(end_byte);

        SourceSpan {
            byte_range: start_byte..end_byte,
            start_line,
            start_col,
            end_line,
            end_col,
        }
    }

    pub fn byte_to_line_col(&self, byte_idx: usize) -> (usize, usize) {
        if self.line_offsets.is_empty() {
            return (1, 1);
        }
        let byte_idx = byte_idx.min(self.source.len());
        match self.line_offsets.binary_search(&byte_idx) {
            Ok(line_idx) => (line_idx + 1, 1),
            Err(line_idx) => {
                let line_num = line_idx;
                let line_start = self.line_offsets[line_idx.saturating_sub(1)];
                let col = byte_idx.saturating_sub(line_start) + 1;
                (line_num, col)
            }
        }
    }

    pub fn file_path(&self) -> &Path {
        &self.file_path
    }

    pub fn source(&self) -> &str {
        &self.source
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_span_and_line_offsets() {
        let text = "SELECT 1;\nSELECT 2;\nSELECT 3;".to_string();
        let doc = SurqlDocument::new(text, PathBuf::from("test.surql"), Vec::new());

        assert_eq!(doc.file_path(), Path::new("test.surql"));
        assert_eq!(doc.source(), "SELECT 1;\nSELECT 2;\nSELECT 3;");

        let (l1, c1) = doc.byte_to_line_col(0);
        assert_eq!((l1, c1), (1, 1));

        let (l2, c2) = doc.byte_to_line_col(10);
        assert_eq!((l2, c2), (2, 1));

        let span = doc.resolve_span(0, 8);
        assert_eq!(span.start_line, 1);
        assert_eq!(span.start_col, 1);
        assert_eq!(span.end_line, 1);
        assert_eq!(span.end_col, 9);
    }
}

