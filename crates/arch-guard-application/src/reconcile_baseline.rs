use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

pub struct ReconcileBaselineUseCase;

impl ReconcileBaselineUseCase {
    pub fn execute(file_path: &Path) -> Result<usize, String> {
        if !file_path.exists() {
            return Ok(0);
        }

        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read baseline file: {}", e))?;

        let mut unique_hashes = BTreeSet::new();
        for word in content.split(|c: char| !c.is_ascii_hexdigit()) {
            if word.len() == 64 {
                unique_hashes.insert(word.to_lowercase());
            }
        }

        let count = unique_hashes.len();
        let json_output = serde_json::to_string_pretty(&unique_hashes.into_iter().collect::<Vec<_>>())
            .map_err(|e| format!("Failed to serialize reconciled baseline: {}", e))?;

        fs::write(file_path, json_output)
            .map_err(|e| format!("Failed to write reconciled baseline: {}", e))?;

        Ok(count)
    }
}
