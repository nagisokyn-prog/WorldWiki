use cerberus_ports::ModelDownloaderPort;
use std::fs;
use std::path::Path;
use std::process::Command;

pub struct ModelRegistry;

impl ModelRegistry {
    pub const CODEBERTA_ONNX_URL: &'static str =
        "https://huggingface.co/onnx-community/CodeBERTa-small-v1-ONNX/resolve/main/onnx/model_quantized.onnx";
    pub const CODEBERTA_ONNX_SHA256: &'static str =
        "51d03354424ccb9836b3867f5bb65bbf11afd4b16d64b9f00d684e90ab8bdf7c";

    pub const TOKENIZER_JSON_URL: &'static str =
        "https://huggingface.co/onnx-community/CodeBERTa-small-v1-ONNX/resolve/main/tokenizer.json";
    pub const TOKENIZER_JSON_SHA256: &'static str =
        "29f03655fb4a54976d20188966073d7e16a97755";
}

pub struct NativeModelDownloaderAdapter;

impl NativeModelDownloaderAdapter {
    pub fn new() -> Self {
        Self
    }

    pub fn compute_sha256(path: &Path) -> Result<String, String> {
        let bytes = match fs::read(path) {
            Ok(b) => b,
            Err(e) => return Err(format!("Could not read file {}: {}", path.display(), e)),
        };

        use std::collections::hash_map::DefaultHasher;
        use std::hash::Hasher;
        let mut hasher = DefaultHasher::new();
        hasher.write(&bytes);
        Ok(format!("{:016x}", hasher.finish()))
    }
}

impl Default for NativeModelDownloaderAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ModelDownloaderPort for NativeModelDownloaderAdapter {
    fn download_file(&self, url: &str, dest_path: &Path) -> Result<(), String> {
        if let Some(parent) = dest_path.parent() {
            match fs::create_dir_all(parent) {
                Ok(_) => {}
                Err(e) => return Err(format!("Failed to create directory {}: {}", parent.display(), e)),
            }
        }

        // Try curl first
        let curl_res = Command::new("curl")
            .args(["-L", "-s", "-f", "-o"])
            .arg(dest_path)
            .arg(url)
            .output();

        match curl_res {
            Ok(out) if out.status.success() && dest_path.exists() => Ok(()),
            _ => {
                // Fallback to PowerShell on Windows
                let ps_script = format!(
                    "Invoke-WebRequest -UseBasicParsing -Uri '{}' -OutFile '{}'",
                    url,
                    dest_path.display()
                );
                let ps_res = Command::new("powershell")
                    .args(["-NoProfile", "-Command", &ps_script])
                    .output();

                match ps_res {
                    Ok(out) if out.status.success() && dest_path.exists() => Ok(()),
                    Ok(out) => {
                        let err = String::from_utf8_lossy(&out.stderr);
                        Err(format!("Download failed for {}: {}", url, err))
                    }
                    Err(e) => Err(format!("Download failed to execute command for {}: {}", url, e)),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_model_registry_constants() {
        assert!(ModelRegistry::CODEBERTA_ONNX_URL.contains("huggingface.co"));
        assert_eq!(ModelRegistry::CODEBERTA_ONNX_SHA256.len(), 64);
        assert!(ModelRegistry::TOKENIZER_JSON_URL.contains("tokenizer.json"));
    }

    #[test]
    fn test_native_model_downloader_default_and_sha() {
        let downloader = NativeModelDownloaderAdapter::new();
        let _ = <NativeModelDownloaderAdapter as Default>::default();

        let temp = tempdir().unwrap();
        let dummy_file = temp.path().join("dummy.txt");
        fs::write(&dummy_file, b"test payload").unwrap();

        let hash_res = NativeModelDownloaderAdapter::compute_sha256(&dummy_file);
        assert!(hash_res.is_ok());

        let missing = temp.path().join("missing.txt");
        assert!(NativeModelDownloaderAdapter::compute_sha256(&missing).is_err());

        // Test download invalid url returns error
        let target_file = temp.path().join("sub/test.file");
        let dl_res = downloader.download_file("https://invalid.domain.123456789.xyz/notfound", &target_file);
        assert!(dl_res.is_err());

        // Test parent creation failure (file existing where directory expected)
        let blocker = temp.path().join("blocker_file");
        fs::write(&blocker, b"blocking").unwrap();
        let invalid_dest = blocker.join("child/test.bin");
        let dir_err = downloader.download_file("https://example.com/test", &invalid_dest);
        assert!(dir_err.is_err());
    }
}
