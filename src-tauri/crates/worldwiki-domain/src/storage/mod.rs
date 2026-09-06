use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct YandexBackupFile {
    pub name: String,
    pub created: String,
    pub size: u64,
}
