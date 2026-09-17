use cerberus_ports::BaselineStoragePort;
use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Arc;

pub struct ReconcileBaselineUseCase {
    storage: Arc<dyn BaselineStoragePort>,
}

impl ReconcileBaselineUseCase {
    pub fn new(storage: Arc<dyn BaselineStoragePort>) -> Self {
        Self { storage }
    }

    pub fn execute(&self, file_path: &Path) -> Result<usize, String> {
        let content = match self.storage.read(file_path)? {
            Some(c) => c,
            None => return Ok(0),
        };

        let unique_hashes = Self::extract_unique_hashes(&content);
        let count = unique_hashes.len();

        let json_output = format!(
            "[\n{}\n]\n",
            unique_hashes
                .iter()
                .map(|h| format!("  \"{}\"", h))
                .collect::<Vec<_>>()
                .join(",\n")
        );

        self.storage.write(file_path, &json_output)?;
        Ok(count)
    }

    pub fn extract_unique_hashes(content: &str) -> BTreeSet<String> {
        let mut unique_hashes = BTreeSet::new();
        for word in content.split(|c: char| !c.is_ascii_hexdigit()) {
            if word.len() == 64 {
                unique_hashes.insert(word.to_lowercase());
            }
        }
        unique_hashes
    }
}
