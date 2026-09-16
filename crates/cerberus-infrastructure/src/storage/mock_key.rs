use cerberus_ports::KeyStoragePort;


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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_storage_adapter() {
        let storage = MockStorageAdapter::new(vec![1, 2, 3]);
        assert_eq!(storage.get_key().unwrap(), vec![1, 2, 3]);
        assert!(storage.set_key(&[4, 5, 6]).is_ok());
    }
}

