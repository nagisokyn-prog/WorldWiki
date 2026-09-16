use arch_guard_ports::BaselineStoragePort;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    struct MockBaselineStorage {
        read_result: Result<Option<String>, String>,
        written_content: Mutex<Option<String>>,
        write_error: Option<String>,
    }

    impl BaselineStoragePort for MockBaselineStorage {
        fn read(&self, _file_path: &Path) -> Result<Option<String>, String> {
            self.read_result.clone()
        }

        fn write(&self, _file_path: &Path, content: &str) -> Result<(), String> {
            if let Some(err) = &self.write_error {
                return Err(err.clone());
            }
            let mut w = self.written_content.lock().unwrap();
            *w = Some(content.to_string());
            Ok(())
        }
    }

    #[test]
    fn test_reconcile_baseline_none_returns_zero() {
        let storage = Arc::new(MockBaselineStorage {
            read_result: Ok(None),
            written_content: Mutex::new(None),
            write_error: None,
        });
        let use_case = ReconcileBaselineUseCase::new(storage);
        let res = use_case.execute(Path::new("baseline.json")).unwrap();
        assert_eq!(res, 0);
    }

    #[test]
    fn test_reconcile_baseline_success_with_duplicates_and_merge_markers() {
        let hash1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let hash2 = "a".repeat(64);
        let conflict_content = format!(
            "<<<<<<< HEAD\n[\n  \"{}\"\n]\n=======\n[\n  \"{}\",\n  \"{}\"\n]\n>>>>>>> branch\n",
            hash1, hash1.to_uppercase(), hash2
        );

        let storage = Arc::new(MockBaselineStorage {
            read_result: Ok(Some(conflict_content)),
            written_content: Mutex::new(None),
            write_error: None,
        });

        let use_case = ReconcileBaselineUseCase::new(storage.clone());
        let res = use_case.execute(Path::new("baseline.json")).unwrap();
        assert_eq!(res, 2);

        let written = storage.written_content.lock().unwrap().clone().unwrap();
        assert!(written.contains(hash1));
        assert!(written.contains(&hash2));
    }

    #[test]
    fn test_reconcile_baseline_errors() {
        // Read error
        let storage_read_err = Arc::new(MockBaselineStorage {
            read_result: Err("Disk read error".into()),
            written_content: Mutex::new(None),
            write_error: None,
        });
        let use_case_read_err = ReconcileBaselineUseCase::new(storage_read_err);
        assert!(use_case_read_err.execute(Path::new("baseline.json")).is_err());

        // Write error
        let hash = "b".repeat(64);
        let storage_write_err = Arc::new(MockBaselineStorage {
            read_result: Ok(Some(hash)),
            written_content: Mutex::new(None),
            write_error: Some("Disk write error".into()),
        });
        let use_case_write_err = ReconcileBaselineUseCase::new(storage_write_err);
        assert!(use_case_write_err.execute(Path::new("baseline.json")).is_err());
    }

    #[test]
    fn test_extract_unique_hashes_edge_cases() {
        let hashes = ReconcileBaselineUseCase::extract_unique_hashes("short 12345 nonhex!@#");
        assert!(hashes.is_empty());

        let valid = "c".repeat(64);
        let hashes2 = ReconcileBaselineUseCase::extract_unique_hashes(&valid);
        assert_eq!(hashes2.len(), 1);
        assert!(hashes2.contains(&valid));
    }
}

