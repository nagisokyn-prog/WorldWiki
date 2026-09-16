use arch_guard_ports::KeyStoragePort;


pub struct KeyringStorageAdapter {
    pub service: String,
    pub user: String,
}

impl KeyringStorageAdapter {
    pub fn new() -> Self {
        Self {
            service: "cargo-arch-guard".into(),
            user: "master-key".into(),
        }
    }
}

impl Default for KeyringStorageAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyStoragePort for KeyringStorageAdapter {
    fn get_key(&self) -> Result<Vec<u8>, String> {
        let entry = keyring::Entry::new(&self.service, &self.user)
            .map_err(|e| format!("Failed to open keyring entry: {}", e))?;
        let secret = entry.get_password()
            .map_err(|e| format!("Key not found in OS Keychain: {}", e))?;
        hex_decode(&secret).map_err(|e| format!("Invalid hex in keychain key: {}", e))
    }

    fn set_key(&self, key: &[u8]) -> Result<(), String> {
        let entry = keyring::Entry::new(&self.service, &self.user)
            .map_err(|e| format!("Failed to open keyring entry: {}", e))?;
        let hex_str = hex_encode(key);
        entry.set_password(&hex_str)
            .map_err(|e| format!("Failed to save key into OS Keychain: {}", e))
    }
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

    #[test]
    fn test_keyring_storage_adapter_creation_and_hex_utils() {
        let adapter = KeyringStorageAdapter::default();
        assert_eq!(adapter.service, "cargo-arch-guard");
        assert_eq!(adapter.user, "master-key");

        let bytes = vec![0x12, 0xAB, 0xCD, 0xEF];
        let hex = hex_encode(&bytes);
        assert_eq!(hex, "12abcdef");

        let decoded = hex_decode(&hex).unwrap();
        assert_eq!(decoded, bytes);

        assert!(hex_decode("123").is_err(), "Odd length should fail");
        assert!(hex_decode("ZZ").is_err(), "Invalid hex chars should fail");

        // Execute get_key and set_key methods directly and via trait object
        let port: &dyn KeyStoragePort = &adapter;
        let _ = port.set_key(&[0x11, 0x22]);
        let _ = port.get_key();
        let _ = adapter.set_key(&[0x11, 0x22]);
        let _ = adapter.get_key();
    }
}


