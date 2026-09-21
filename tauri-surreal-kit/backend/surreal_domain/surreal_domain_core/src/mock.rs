use crate::error::SurrealDomainError;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// In-memory mock repository for unit testing without a live SurrealDB instance.
#[derive(Clone, Default)]
pub struct MockSurrealRepo<T> {
    storage: Arc<Mutex<HashMap<String, T>>>,
}

impl<T: Clone> MockSurrealRepo<T> {
    pub fn new() -> Self {
        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn insert(&self, id: impl Into<String>, entity: T) {
        let mut guard = match self.storage.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        guard.insert(id.into(), entity);
    }

    pub fn get(&self, id: &str) -> Result<Option<T>, SurrealDomainError> {
        let guard = match self.storage.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        Ok(guard.get(id).cloned())
    }

    pub fn remove(&self, id: &str) -> Result<(), SurrealDomainError> {
        let mut guard = match self.storage.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        guard.remove(id);
        Ok(())
    }

    pub fn list(&self) -> Result<Vec<T>, SurrealDomainError> {
        let guard = match self.storage.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        Ok(guard.values().cloned().collect())
    }

    pub fn clear(&self) {
        let mut guard = match self.storage.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        guard.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_repo_operations() {
        let repo = MockSurrealRepo::<String>::new();
        repo.insert("item:1", "First".to_string());
        repo.insert("item:2", "Second".to_string());

        let item = repo.get("item:1").unwrap();
        assert_eq!(item, Some("First".to_string()));

        let list = repo.list().unwrap();
        assert_eq!(list.len(), 2);

        repo.remove("item:1").unwrap();
        assert_eq!(repo.get("item:1").unwrap(), None);

        repo.clear();
        assert_eq!(repo.list().unwrap().len(), 0);
    }
}
