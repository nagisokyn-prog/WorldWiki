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
        if model_path.exists() {
            if let Err(e) = fs::remove_file(&model_path) {
                return Err(format!("Failed to remove {}: {}", model_path.display(), e));
            }
            deleted += 1;
        }

        let tokenizer_path = target_dir.join("tokenizer.json");
        if tokenizer_path.exists() {
            if let Err(e) = fs::remove_file(&tokenizer_path) {
                return Err(format!("Failed to remove {}: {}", tokenizer_path.display(), e));
            }
            deleted += 1;
        }

        Ok(deleted)
    }
}
