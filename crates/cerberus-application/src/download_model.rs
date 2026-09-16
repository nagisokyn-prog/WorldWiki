use cerberus_ports::ModelDownloaderPort;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Debug, PartialEq, Eq)]
pub struct ModelStatus {
    pub model_exists: bool,
    pub tokenizer_exists: bool,
    pub model_path: PathBuf,
    pub tokenizer_path: PathBuf,
}

pub struct DownloadModelUseCase {
    pub downloader: Arc<dyn ModelDownloaderPort>,
}

impl DownloadModelUseCase {
    pub fn new(downloader: Arc<dyn ModelDownloaderPort>) -> Self {
        Self { downloader }
    }

    pub fn download(
        &self,
        target_dir: &Path,
        onnx_url: &str,
        tokenizer_url: &str,
    ) -> Result<(), String> {
        let model_path = target_dir.join("model_quantized.onnx");
        let tokenizer_path = target_dir.join("tokenizer.json");

        match fs::create_dir_all(target_dir) {
            Ok(_) => {}
            Err(e) => return Err(format!("Failed to create model cache directory: {}", e)),
        }

        self.downloader.download_file(onnx_url, &model_path)?;
        self.downloader.download_file(tokenizer_url, &tokenizer_path)?;

        Ok(())
    }

    pub fn status(&self, target_dir: &Path) -> ModelStatus {
        let model_path = target_dir.join("model_quantized.onnx");
        let tokenizer_path = target_dir.join("tokenizer.json");

        ModelStatus {
            model_exists: model_path.exists(),
            tokenizer_exists: tokenizer_path.exists(),
            model_path,
            tokenizer_path,
        }
    }

    pub fn clean(&self, target_dir: &Path) -> Result<usize, String> {
        if !target_dir.exists() {
            return Ok(0);
        }

        let mut deleted = 0;
        let model_path = target_dir.join("model_quantized.onnx");
        if model_path.exists() {
            match fs::remove_file(&model_path) {
                Ok(_) => deleted += 1,
                Err(e) => return Err(format!("Failed to remove {}: {}", model_path.display(), e)),
            }
        }

        let tokenizer_path = target_dir.join("tokenizer.json");
        if tokenizer_path.exists() {
            match fs::remove_file(&tokenizer_path) {
                Ok(_) => deleted += 1,
                Err(e) => return Err(format!("Failed to remove {}: {}", tokenizer_path.display(), e)),
            }
        }

        Ok(deleted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    struct MockDownloader {
        should_fail: bool,
    }

    impl ModelDownloaderPort for MockDownloader {
        fn download_file(&self, _url: &str, dest_path: &Path) -> Result<(), String> {
            if self.should_fail {
                Err("Simulated download error".to_string())
            } else {
                if let Some(parent) = dest_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                match fs::write(dest_path, b"mock payload") {
                    Ok(_) => Ok(()),
                    Err(e) => Err(format!("Write failed: {}", e)),
                }
            }
        }
    }

    #[test]
    fn test_download_model_use_case_success_status_and_clean() {
        let temp = tempdir().unwrap();
        let target_dir = temp.path().join("codeberta");

        let downloader = Arc::new(MockDownloader { should_fail: false });
        let use_case = DownloadModelUseCase::new(downloader);

        // Initial status: both false
        let initial_status = use_case.status(&target_dir);
        assert!(!initial_status.model_exists);
        assert!(!initial_status.tokenizer_exists);

        // Clean on non-existing directory returns 0
        assert_eq!(use_case.clean(&target_dir).unwrap(), 0);

        // Download
        let dl_res = use_case.download(&target_dir, "http://mock/model.onnx", "http://mock/tokenizer.json");
        assert!(dl_res.is_ok());

        // Status after download
        let after_status = use_case.status(&target_dir);
        assert!(after_status.model_exists);
        assert!(after_status.tokenizer_exists);

        // Clean deletes 2 files
        assert_eq!(use_case.clean(&target_dir).unwrap(), 2);
        assert_eq!(use_case.clean(&target_dir).unwrap(), 0);
    }

    #[test]
    fn test_download_model_use_case_errors() {
        let temp = tempdir().unwrap();
        let target_dir = temp.path().join("codeberta");

        let failing_downloader = Arc::new(MockDownloader { should_fail: true });
        let use_case = DownloadModelUseCase::new(failing_downloader);

        let dl_res = use_case.download(&target_dir, "http://mock/model.onnx", "http://mock/tokenizer.json");
        assert!(dl_res.is_err());
    }
}
