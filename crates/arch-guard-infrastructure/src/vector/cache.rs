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

        let file = match File::open(&self.cache_file) {
            Ok(f) => f,
            Err(_) => return Ok(None),
        };

        // Acquire shared lock
        file.lock_shared()
            .map_err(|e| format!("Failed to acquire shared lock on pattern cache: {}", e))?;

        use std::io::Read;
        let mut data = Vec::new();
        let mut reader = std::io::BufReader::new(&file);
        let _ = reader.read_to_end(&mut data);

        let _ = file.unlock();
        if data.is_empty() {
            Ok(None)
        } else {
            Ok(Some(data))
        }
    }

    pub fn write_cached(&self, data: &[u8]) -> Result<(), String> {
        if let Some(parent) = self.cache_file.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&self.cache_file)
            .map_err(|e| format!("Failed to open cache file for write: {}", e))?;

        // Acquire exclusive lock BEFORE truncating
        file.lock_exclusive()
            .map_err(|e| format!("Failed to acquire exclusive lock on pattern cache: {}", e))?;

        use std::io::{Seek, SeekFrom, Write};
        let _ = file.set_len(0);
        let _ = file.seek(SeekFrom::Start(0));
        file.write_all(data)
            .map_err(|e| format!("Failed to write pattern cache: {}", e))?;
        file.flush()
            .map_err(|e| format!("Failed to flush pattern cache: {}", e))?;

        let _ = file.unlock();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_pattern_cache_roundtrip() {
        let temp = tempdir().unwrap();
        let cache = PatternCache::new(temp.path());

        // 1. Missing cache returns None
        assert_eq!(cache.read_cached().unwrap(), None);

        // 2. Write data and read back
        let data = b"serialized_patterns_12345";
        cache.write_cached(data).unwrap();

        let read_back = cache.read_cached().unwrap();
        assert_eq!(read_back, Some(data.to_vec()));
    }

    #[test]
    fn test_pattern_cache_empty_file_returns_none() {
        let temp = tempdir().unwrap();
        let cache = PatternCache::new(temp.path());
        cache.write_cached(&[]).unwrap();
        assert_eq!(cache.read_cached().unwrap(), None);
    }

    #[test]
    fn test_pattern_cache_directory_open_fails_returns_none() {
        let temp = tempdir().unwrap();
        let cache_dir = temp.path().join(".archguard").join("cache").join("patterns.bin");
        // Create patterns.bin as a directory so File::open fails
        fs::create_dir_all(&cache_dir).unwrap();

        let cache = PatternCache::new(temp.path());
        assert_eq!(cache.read_cached().unwrap(), None);

        // write_cached fails because patterns.bin is a directory
        assert!(cache.write_cached(b"data").is_err());
    }
}


