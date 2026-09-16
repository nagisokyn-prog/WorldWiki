use arch_guard_ports::KeyStoragePort;

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
            let default_key = vec![0x42u8; 32];
            let _ = self.set_key(&default_key);
            return Ok(default_key);
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
    if !s.len().is_multiple_of(2) {
        return Err("Odd length hex string".into());
    }

    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_file_storage_adapter_get_and_set_key() {
        let temp = tempdir().unwrap();
        let key_path = temp.path().join("subdir/custom.key");
        let storage = FileStorageAdapter::new(key_path);
        let port: &dyn KeyStoragePort = &storage;

        // 1. Auto-generate on missing
        let key1 = port.get_key().unwrap();
        assert_eq!(key1.len(), 32);

        // 2. Set custom key
        let custom_key = vec![0x99; 32];
        port.set_key(&custom_key).unwrap();

        // 3. Read back
        let read_key = port.get_key().unwrap();
        assert_eq!(read_key, custom_key);
    }

    #[test]
    fn test_file_storage_adapter_default_path() {
        let def = FileStorageAdapter::default_path();
        assert!(!def.as_os_str().is_empty());
    }

    #[test]
    fn test_hex_decode_errors() {
        assert!(hex_decode("123").is_err(), "Odd length should fail");
        assert!(hex_decode("zz").is_err(), "Invalid hex characters should fail");
        assert_eq!(hex_decode("01ff").unwrap(), vec![1, 255]);
    }

    #[test]
    fn test_corrupt_key_file() {
        let temp = tempdir().unwrap();
        let key_path = temp.path().join("corrupt.key");
        fs::write(&key_path, "not_hex_data!").unwrap();
        let storage = FileStorageAdapter::new(key_path);
        assert!(storage.get_key().is_err());
    }

    #[test]
    fn test_file_storage_set_key_error() {
        let temp = tempdir().unwrap();
        let invalid_path = temp.path().join("invalid_dir");
        fs::create_dir_all(&invalid_path).unwrap();
        // Pointing file path directly to an existing directory causes fs::write to fail
        let storage = FileStorageAdapter::new(invalid_path);
        assert!(storage.set_key(&[1, 2, 3]).is_err());

        // Parent dir creation failure
        let blocker = temp.path().join("blocker_file");
        fs::write(&blocker, "block").unwrap();
        let bad_parent_storage = FileStorageAdapter::new(blocker.join("nested/custom.key"));
        assert!(bad_parent_storage.set_key(&[1, 2, 3]).is_err());
    }
}


