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

        if let Err(e) = fs::create_dir_all(target_dir) {
            return Err(format!("Failed to create model cache directory: {}", e));
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
        if model_path.is_file() {
            let _ = fs::remove_file(&model_path);
            deleted += 1;
        }

        let tokenizer_path = target_dir.join("tokenizer.json");
        if tokenizer_path.is_file() {
            let _ = fs::remove_file(&tokenizer_path);
            deleted += 1;
        }

        Ok(deleted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    struct DummyDownloader(u8);
    impl ModelDownloaderPort for DummyDownloader {
        fn download_file(&self, _url: &str, dest: &Path) -> Result<(), String> {
            match self.0 {
                0 => Err("Download failed".into()),
                1 => {
                    let _ = fs::write(dest, b"test");
                    Ok(())
                }
                _ => {
                    if dest.ends_with("tokenizer.json") {
                        Err("Tokenizer failed".into())
                    } else {
                        let _ = fs::write(dest, b"test");
                        Ok(())
                    }
                }
            }
        }
    }

    #[test]
    fn test_download_model_full_lifecycle() {
        let temp = tempdir().unwrap();
        let use_case = DownloadModelUseCase::new(Arc::new(DummyDownloader(1)));

        let status_before = use_case.status(temp.path());
        assert!(!status_before.model_exists);
        assert!(!status_before.tokenizer_exists);

        assert!(use_case.download(temp.path(), "http://model", "http://tokenizer").is_ok());

        let status_after = use_case.status(temp.path());
        assert!(status_after.model_exists);
        assert!(status_after.tokenizer_exists);
        assert_eq!(status_after, status_after);
        assert_ne!(status_before, status_after);
        assert!(PartialEq::ne(&status_before, &status_after));
        assert!(!PartialEq::ne(&status_after, &status_after));
        assert!(PartialEq::eq(&status_after, &status_after));
        assert!(!PartialEq::eq(&status_before, &status_after));
        let _ = format!("{:?}", status_after);

        let cleaned = use_case.clean(temp.path()).unwrap();
        assert_eq!(cleaned, 2);

        // Clean on non-existent dir
        let non_existent = temp.path().join("none");
        assert_eq!(use_case.clean(&non_existent).unwrap(), 0);

        // Failing download first file
        let fail_use_case = DownloadModelUseCase::new(Arc::new(DummyDownloader(0)));
        assert!(fail_use_case.download(temp.path(), "http://model", "http://tokenizer").is_err());

        // Failing download second file (tokenizer)
        let fail_tokenizer = DownloadModelUseCase::new(Arc::new(DummyDownloader(2)));
        assert!(fail_tokenizer.download(temp.path(), "http://model", "http://tokenizer").is_err());

        // create_dir_all error (file passed as dir path)
        let file_as_dir = temp.path().join("blocker_file");
        fs::write(&file_as_dir, b"block").unwrap();
        let bad_sub = file_as_dir.join("sub");
        assert!(use_case.download(&bad_sub, "http://model", "http://tokenizer").is_err());
    }
}


