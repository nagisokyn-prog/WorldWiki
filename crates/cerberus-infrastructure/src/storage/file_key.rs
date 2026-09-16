use cerberus_ports::KeyStoragePort;

use std::fs;
use std::path::PathBuf;

pub struct FileStorageAdapter {
    pub path: PathBuf,
}

impl FileStorageAdapter {
    pub fn default_path() -> PathBuf {
        Self::resolve_default_path(dirs_home())
    }

    pub fn resolve_default_path(home: Option<PathBuf>) -> PathBuf {
        if let Some(h) = home {
            h.join(".config").join("cerberus").join("master.key")
        } else {
            PathBuf::from(".cerberus/master.key")
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
    resolve_home_from_vars(std::env::var_os("USERPROFILE"), std::env::var_os("HOME"))
}

pub fn resolve_home_from_vars(
    userprofile: Option<std::ffi::OsString>,
    home: Option<std::ffi::OsString>,
) -> Option<PathBuf> {
    match (userprofile, home) {
        (Some(up), _) => Some(PathBuf::from(up)),
        (None, Some(h)) => Some(PathBuf::from(h)),
        (None, None) => None,
    }
}

fn hex_encode(data: &[u8]) -> String {
    let mut s = String::with_capacity(data.len() * 2);
    for &b in data {
        use std::fmt::Write;
        let _ = write!(s, "{:02x}", b);
    }
    s
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if !s.len().is_multiple_of(2) {
        return Err("Odd length hex string".into());
    }

    let mut bytes = Vec::with_capacity(s.len() / 2);
    for i in (0..s.len()).step_by(2) {
        match u8::from_str_radix(&s[i..i + 2], 16) {
            Ok(b) => bytes.push(b),
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;
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

        let custom_home = FileStorageAdapter::resolve_default_path(Some(PathBuf::from("/custom/home")));
        assert_eq!(custom_home, PathBuf::from("/custom/home/.config/cerberus/master.key"));

        let none_home = FileStorageAdapter::resolve_default_path(None);
        assert_eq!(none_home, PathBuf::from(".cerberus/master.key"));
    }

    #[test]
    fn test_resolve_home_from_vars() {
        assert_eq!(
            resolve_home_from_vars(Some(OsString::from("C:\\Users\\Test")), None),
            Some(PathBuf::from("C:\\Users\\Test"))
        );
        assert_eq!(
            resolve_home_from_vars(None, Some(OsString::from("/home/user"))),
            Some(PathBuf::from("/home/user"))
        );
        assert_eq!(resolve_home_from_vars(None, None), None);
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
        let storage = FileStorageAdapter::new(invalid_path);
        assert!(storage.set_key(&[1, 2, 3]).is_err());
        assert!(storage.get_key().is_err());

        // Parent dir creation failure
        let blocker = temp.path().join("blocker_file");
        fs::write(&blocker, "block").unwrap();
        let bad_parent_storage = FileStorageAdapter::new(blocker.join("nested/custom.key"));
        assert!(bad_parent_storage.set_key(&[1, 2, 3]).is_err());
    }
}
