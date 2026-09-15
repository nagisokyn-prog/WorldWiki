use arch_guard_ports::BaselineStoragePort;
use std::fs;
use std::path::Path;

pub struct FileBaselineStorageAdapter;

impl FileBaselineStorageAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for FileBaselineStorageAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl BaselineStoragePort for FileBaselineStorageAdapter {
    fn read(&self, path: &Path) -> Result<Option<String>, String> {
        if !path.exists() {
            return Ok(None);
        }
        fs::read_to_string(path).map(Some).map_err(|e| format!("Failed to read baseline file: {}", e))
    }

    fn write(&self, path: &Path, content: &str) -> Result<(), String> {
        fs::write(path, content).map_err(|e| format!("Failed to write baseline file: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_file_baseline_storage_read_and_write() {
        let temp = tempdir().unwrap();
        let file_path = temp.path().join("baseline.json");
        let storage = FileBaselineStorageAdapter::new();

        // 1. Read nonexistent
        let init_read = storage.read(&file_path).unwrap();
        assert_eq!(init_read, None);

        // 2. Write
        storage.write(&file_path, "[\"hash1\", \"hash2\"]").unwrap();

        // 3. Read back
        let after_write = storage.read(&file_path).unwrap();
        assert_eq!(after_write, Some("[\"hash1\", \"hash2\"]".into()));
    }
}

