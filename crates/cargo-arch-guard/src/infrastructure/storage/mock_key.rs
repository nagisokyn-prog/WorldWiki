use crate::ports::storage::KeyStoragePort;

pub struct MockStorageAdapter {
    pub key: Vec<u8>,
}

impl MockStorageAdapter {
    pub fn new(key: Vec<u8>) -> Self {
        Self { key }
    }
}

impl KeyStoragePort for MockStorageAdapter {
    fn get_key(&self) -> Result<Vec<u8>, String> {
        Ok(self.key.clone())
    }

    fn set_key(&self, key: &[u8]) -> Result<(), String> {
        let _ = key;
        Ok(())
    }
}
