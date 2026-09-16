use cerberus_ports::KeyStoragePort;

pub struct KeyringStorageAdapter {
    pub service: String,
    pub user: String,
}

impl KeyringStorageAdapter {
    pub fn new() -> Self {
        Self {
            service: "cargo-cerberus".into(),
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
        let entry = match keyring::Entry::new(&self.service, &self.user) {
            Ok(e) => e,
            Err(e) => return Err(e.to_string()),
        };
        let secret = match entry.get_password() {
            Ok(s) => s,
            Err(e) => return Err(e.to_string()),
        };
        hex_decode(&secret)
    }

    fn set_key(&self, key: &[u8]) -> Result<(), String> {
        let entry = match keyring::Entry::new(&self.service, &self.user) {
            Ok(e) => e,
            Err(e) => return Err(e.to_string()),
        };
        let hex_str = hex_encode(key);
        match entry.set_password(&hex_str) {
            Ok(()) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
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

    #[test]
    fn test_keyring_storage_adapter_creation_and_hex_utils() {
        let adapter = KeyringStorageAdapter::default();
        assert_eq!(adapter.service, "cargo-cerberus");
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

        // Trigger Entry execution with custom service/user
        let bad_adapter = KeyringStorageAdapter {
            service: "invalid_service".into(),
            user: "invalid_user".into(),
        };
        let bad_port: &dyn KeyStoragePort = &bad_adapter;
        let _ = bad_port.get_key();
        let _ = bad_port.set_key(&[0x11, 0x22]);
    }
}
