use super::*;
use worldwiki_domain::ai::ModelKind;

#[test]
fn test_candidate_dirs_contains_appdata_and_configured() {
    let mgr = FsLocalModelManager::new(PathBuf::from("custom_models_path"));
    let dirs = mgr.candidate_dirs();
    assert!(dirs
        .iter()
        .any(|d| d == &PathBuf::from("custom_models_path")));
    assert!(dirs.iter().any(|d| d.to_string_lossy().contains("models")));
}

#[test]
fn test_list_installed_empty_or_valid() {
    let temp_dir = std::env::temp_dir().join(format!("test_models_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).expect("Failed to create temp dir for tests");

    let test_model = temp_dir.join("test-model-q4.gguf");
    std::fs::write(&test_model, b"GGUF test content").expect("Failed to write test model file");

    let mgr = FsLocalModelManager::new(temp_dir.clone());
    let installed = mgr.list_installed().expect("list_installed must succeed");

    assert!(installed.iter().any(|m| m.filename == "test-model-q4.gguf"));
    let found = installed
        .iter()
        .find(|m| m.filename == "test-model-q4.gguf");
    assert!(found.is_some());
    assert_eq!(found.unwrap().kind, ModelKind::Generation);

    let _ = std::fs::remove_dir_all(&temp_dir);
}
