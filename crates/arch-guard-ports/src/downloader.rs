use std::path::Path;

pub trait ModelDownloaderPort: Send + Sync {
    fn download_file(&self, url: &str, dest_path: &Path) -> Result<(), String>;
}
