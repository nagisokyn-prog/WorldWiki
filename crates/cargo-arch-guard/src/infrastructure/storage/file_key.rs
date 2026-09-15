use crate::ports::storage::KeyStoragePort;
use std::fs;
use std::path::PathBuf;

pub struct FileStorageAdapter {
    pub path: PathBuf,
}

impl FileStorageAdapter {
    pub fn default_path() -> PathBuf {
        if let Some(home) = dirs_home() {
            home.join(".config").join("archguard").join("master.key")
        } else {
            PathBuf::from(".archguard/master.key")
        }
    }

    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl KeyStoragePort for FileStorageAdapter {
    fn get_key(&self) -> Result<Vec<u8>, String> {
        if !self.path.exists() {
            return Err(format!("Master key file not found at {}", self.path.display()));
        }
        let content = fs::read_to_string(&self.path)
            .map_err(|e| format!("Failed to read key file {}: {}", self.path.display(), e))?;
        let trimmed = content.trim();
        hex_decode(trimmed).map_err(|e| format!("Invalid hex key: {}", e))
    }

    fn set_key(&self, key: &[u8]) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir {}: {}", parent.display(), e))?;
        }
        let hex_str = hex_encode(key);
        fs::write(&self.path, hex_str).map_err(|e| format!("Failed to write key to {}: {}", self.path.display(), e))?;
        Ok(())
    }
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

fn hex_encode(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err("Odd length hex string".into());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}
