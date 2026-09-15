use fs2::FileExt;
use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};

pub struct PatternCache {
    cache_file: PathBuf,
}

impl PatternCache {
    pub fn new(workspace_root: &Path) -> Self {
        let dir = workspace_root.join(".archguard").join("cache");
        let _ = fs::create_dir_all(&dir);
        Self {
            cache_file: dir.join("patterns.bin"),
        }
    }

    pub fn read_cached(&self) -> Result<Option<Vec<u8>>, String> {
        if !self.cache_file.exists() {
            return Ok(None);
        }

        let file = File::open(&self.cache_file)
            .map_err(|e| format!("Failed to open cache file: {}", e))?;

        // Acquire shared lock
        file.lock_shared()
            .map_err(|e| format!("Failed to acquire shared lock on pattern cache: {}", e))?;

        let data = fs::read(&self.cache_file)
            .map_err(|e| format!("Failed to read pattern cache: {}", e))?;

        let _ = file.unlock();
        Ok(Some(data))
    }

    pub fn write_cached(&self, data: &[u8]) -> Result<(), String> {
        if let Some(parent) = self.cache_file.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&self.cache_file)
            .map_err(|e| format!("Failed to open cache file for write: {}", e))?;

        // Acquire exclusive lock
        file.lock_exclusive()
            .map_err(|e| format!("Failed to acquire exclusive lock on pattern cache: {}", e))?;

        fs::write(&self.cache_file, data)
            .map_err(|e| format!("Failed to write pattern cache: {}", e))?;

        let _ = file.unlock();
        Ok(())
    }
}
