use cerberus_application::DownloadModelUseCase;
use cerberus_ports::ModelDownloaderPort;
use std::fs;
use std::path::Path;
use std::sync::Arc;
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
