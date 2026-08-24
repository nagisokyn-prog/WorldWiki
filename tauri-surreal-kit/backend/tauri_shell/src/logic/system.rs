pub use crate::logic::system_core::*;
use serde_json::Value;

// ─── Tauri Command Handlers ───────────────────────────────────────────────────

/// Upload a photo/image bytes → saves to `data/user_images/` with a timestamp prefix.
#[tauri::command]
pub async fn upload_photo(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    upload_photo_core(bytes, filename).await
}

/// Copy a background file from absolute path -> saves to `data/user_images/`
#[tauri::command]
pub async fn copy_background_file(source_path: String) -> Result<String, String> {
    copy_background_file_core(source_path).await
}

/// Read a local file and return its bytes (used to serve local images to the webview).
#[tauri::command]
pub async fn get_local_file(path: String) -> Result<Vec<u8>, String> {
    get_local_file_core(path).await
}

// ─── Performance ──────────────────────────────────────────────────────────────

use crate::logic::performance::PerformanceInfo;

#[tauri::command]
pub fn run_performance_benchmark() -> PerformanceInfo {
    crate::logic::performance::run_benchmark()
}

#[tauri::command]
pub fn get_performance_styles(level: String) -> String {
    let perf = match level.as_str() {
        "low" => crate::logic::performance::PerformanceLevel::Low,
        "medium" => crate::logic::performance::PerformanceLevel::Medium,
        _ => crate::logic::performance::PerformanceLevel::High,
    };
    crate::logic::performance::get_performance_css(&perf)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/// Persist app settings JSON to `data/settings.json`.
#[tauri::command]
pub async fn save_settings(settings: Value) -> Result<(), String> {
    save_settings_core(settings).await
}

/// Load app settings JSON from `data/settings.json`. Returns `null` if not found.
#[tauri::command]
pub async fn load_settings() -> Result<Value, String> {
    load_settings_core().await
}

// ─── Window ───────────────────────────────────────────────────────────────────

/// Toggle fullscreen mode for the current Tauri window.
#[tauri::command]
pub async fn toggle_fullscreen<R: tauri::Runtime>(window: tauri::WebviewWindow<R>) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Themes ───────────────────────────────────────────────────────────────────

/// List all custom themes stored as `data/settings-<name>.json`
#[tauri::command]
pub async fn get_custom_themes() -> Result<Vec<String>, String> {
    get_custom_themes_core().await
}

/// Load a theme by name from `data/settings-<theme>.json`.
#[tauri::command]
pub async fn load_theme(theme: String) -> Result<Value, String> {
    load_theme_core(theme).await
}

/// Save a custom theme to `data/settings-<name>.json`.
#[tauri::command]
pub async fn save_custom_theme(name: String, settings: Value) -> Result<(), String> {
    save_custom_theme_core(name, settings).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use serde_json::json;
    use std::fs;
    use tempfile::TempDir;
    use tauri::Manager;

    /// Локальный провайдер data-dir для unit-тестов (аналогичен
    /// tests/common::TestDataDirProvider, но не зависит от integration-only crate root).
    #[derive(Debug)]
    struct TestDataDirProvider {
        data_dir: std::path::PathBuf,
    }

    impl DataDirProvider for TestDataDirProvider {
        fn get_data_dir(&self) -> std::path::PathBuf {
            self.data_dir.clone()
        }
    }

    /// Временный `data/` каталог + установка провайдера.
    fn setup_temp_data_dir() -> TempDir {
        let temp = TempDir::new().expect("temp dir");
        let data_dir = temp.path().join("data");
        fs::create_dir_all(&data_dir).expect("create data dir");
        set_data_dir_provider(Box::new(TestDataDirProvider { data_dir }));
        temp
    }

    /// Сброс провайдера после теста (изоляция глобального состояния).
    fn teardown_data_dir() {
        clear_data_dir_provider();
    }

    #[test]
    fn test_system_commands_generate_handler() {
        let app = tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![
                upload_photo,
                copy_background_file,
                get_local_file,
                run_performance_benchmark,
                get_performance_styles,
                save_settings,
                load_settings,
                toggle_fullscreen,
                get_custom_themes,
                load_theme,
                save_custom_theme,
            ])
            .build(tauri::generate_context!())
            .unwrap();

        if let Some(win) = app.webview_windows().values().next() {
            let window = win.clone();
            let _ = tauri::async_runtime::block_on(toggle_fullscreen(window));
        }

// Cover all command handlers
        let _ = tauri::async_runtime::block_on(upload_photo(vec![1, 2, 3], "test.png".into()));
        let _ = tauri::async_runtime::block_on(copy_background_file("test.jpg".into()));
        let _ = tauri::async_runtime::block_on(get_local_file("test.png".into()));
        let _ = run_performance_benchmark();
        // Cover all branches of get_performance_styles match
        let _ = get_performance_styles("low".into());
        let _ = get_performance_styles("medium".into());
        let _ = get_performance_styles("high".into());
        let _ = get_performance_styles("potato".into()); // default branch
        let _ = tauri::async_runtime::block_on(save_settings(serde_json::json!({"test": true})));
        let _ = tauri::async_runtime::block_on(load_settings());
        let _ = tauri::async_runtime::block_on(get_custom_themes());
        let _ = tauri::async_runtime::block_on(load_theme("dark".into()));
        let _ = tauri::async_runtime::block_on(save_custom_theme("test".into(), serde_json::json!({})));
                // Cover toggle_fullscreen - create window and call directly
        let _window = tauri::WebviewWindowBuilder::new(&app, "main", tauri::WebviewUrl::App("index.html".into()))
            .build()
            .expect("Failed to build test window");
        if let Some(win) = app.webview_windows().values().next() {
            let window = win.clone();
            let _ = tauri::async_runtime::block_on(toggle_fullscreen(window));
        }

    }

    // ─── upload_photo: успешная запись + roundtrip байтов ────────────────────────

    #[tokio::test]
    #[serial]
    async fn test_upload_photo_saves_file_with_timestamp_prefix() {
        let temp = setup_temp_data_dir();

        let bytes = b"fake PNG image data \x89PNG\r\n\x1a\n".to_vec();
        let filename = "vacation.png".to_string();

        let saved_path = upload_photo(bytes.clone(), filename.clone())
            .await
            .expect("upload_photo should succeed");

        assert!(
            saved_path.contains(&format!("_{}", filename)),
            "saved path should contain _{}: {}",
            filename,
            saved_path
        );
        assert!(
            std::path::Path::new(&saved_path).exists(),
            "saved file must exist"
        );
        let read_back = fs::read(&saved_path).expect("read back file");
        assert_eq!(read_back, bytes, "content must roundtrip");

        let user_images = temp.path().join("data").join("user_images");
        assert!(user_images.exists(), "user_images dir should be created");

        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_upload_photo_writable_dir_succeeds() {
        let _temp = setup_temp_data_dir();
        let path = upload_photo(b"img".to_vec(), "ok.png".to_string())
            .await
            .expect("upload must succeed when data dir is writable");
        assert!(std::path::Path::new(&path).exists());
        teardown_data_dir();
    }

    // ─── copy_background_file ──────────────────────────────────────────────────

    #[tokio::test]
    #[serial]
    async fn test_copy_background_file_preserves_binary_content() {
        let temp = setup_temp_data_dir();

        let content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR".to_vec();
        let source_path = temp.path().join("sources").join("source_bg.png");
        fs::create_dir_all(source_path.parent().unwrap()).unwrap();
        fs::write(&source_path, &content).expect("write source");

        let copied = copy_background_file(source_path.to_string_lossy().to_string())
            .await
            .expect("copy should succeed");

        assert!(copied.contains("_source_bg.png"), "copied path: {}", copied);
        assert!(std::path::Path::new(&copied).exists(), "copied file must exist");
        let read_back = fs::read(&copied).expect("read back copied file");
        assert_eq!(read_back, content, "content must be preserved");

        teardown_data_dir();
    }

    #[tokio::test]
    async fn test_copy_background_file_missing_source_returns_err() {
        let result = copy_background_file("/nonexistent/source_xyz.png".to_string()).await;
        assert!(result.is_err(), "missing source must yield error: {:?}", result);
    }

    // ─── get_local_file ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_get_local_file_reads_bytes() {
        let temp = TempDir::new().expect("temp dir");
        let file_path = temp.path().join("snapshot.bin");
        let payload = b"binary-payload-bytes".to_vec();
        fs::write(&file_path, &payload).expect("write fixture");

        let bytes = get_local_file(file_path.to_string_lossy().to_string())
            .await
            .expect("reading existing file must succeed");
        assert_eq!(bytes, payload, "content must match");
    }

    #[tokio::test]
    async fn test_get_local_file_missing_path_returns_err() {
        let result = get_local_file("/nonexistent/file_xyz.bin".to_string()).await;
        assert!(result.is_err(), "missing file must yield error");
    }

        // ─── settings roundtrip ──────────────────────────────────────────────────────

    #[tokio::test]
    #[serial]
    async fn test_save_settings_creates_file() {
        let temp = setup_temp_data_dir();

        let settings = json!({
            "locale": "en",
            "colors": { "bgBase": "#ffffff" },
            "perf": { "qualityLevel": 75 }
        });

        let result = save_settings(settings.clone()).await;
        assert!(result.is_ok(), "save_settings should succeed: {:?}", result.err());

        let settings_path = temp.path().join("data").join("settings.json");
        assert!(settings_path.exists(), "settings.json should exist");
        let content = fs::read_to_string(&settings_path).expect("read settings.json");
        let saved: serde_json::Value = serde_json::from_str(&content).expect("parse JSON");
        assert_eq!(saved["locale"], "en");
        assert_eq!(saved["colors"]["bgBase"], "#ffffff");
        assert_eq!(saved["perf"]["qualityLevel"], 75);

        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_load_settings_returns_saved() {
        let _temp = setup_temp_data_dir();

        let settings = json!({ "locale": "fr", "colors": { "bgBase": "#000000" } });
        save_settings(settings).await.expect("save");

        let loaded = load_settings().await.expect("load");
        assert_eq!(loaded["locale"], "fr");
        assert_eq!(loaded["colors"]["bgBase"], "#000000");

        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_load_settings_returns_null_when_no_file() {
        let _temp = setup_temp_data_dir();
        let loaded = load_settings().await.expect("load should not panic");
        assert_eq!(loaded, serde_json::Value::Null);
        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_save_settings_overwrites_existing() {
        let _temp = setup_temp_data_dir();

        save_settings(json!({ "locale": "en", "test": "initial" }))
            .await
            .expect("save initial");
        save_settings(json!({ "locale": "de", "test": "updated", "newField": 123 }))
            .await
            .expect("save updated");

        let loaded = load_settings().await.expect("load after overwrite");
        assert_eq!(loaded["locale"], "de");
        assert_eq!(loaded["test"], "updated");
        assert_eq!(loaded["newField"], 123);

        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_save_settings_roundtrip_full_schema() {
        let _temp = setup_temp_data_dir();

        let original = json!({
            "locale": "en", "colors": { "accent": "#8b5cf6", "bgBase": "#ffffff" },
            "glass": { "blur": 24 }, "radii": { "sm": 4 },
            "shadows": { "card": "0 4px" }, "animations": { "duration": 300 },
            "fonts": { "base": 14 }, "spacing": { "density": 1, "gap": 16 },
            "layout": { "columns": 2, "focusMode": false }, "inputs": { "style": "outline" },
            "buttons": { "hoverScale": true }, "tabs": { "pos": "row" },
            "dropdowns": { "use3DWheel": true }, "cards": { "compactList": false },
            "editor": { "autoSaveInterval": 60, "maxSnapshots": 10 },
            "notifications": { "duration": 3000, "position": "bottom-right" },
            "perf": { "level": "auto", "fpsLimit": 60, "qualityLevel": 100 },
            "background": { "type": "none", "opacity": 1, "blur": 0, "fit": "cover" }
        });

        save_settings(original).await.expect("save settings");
        let loaded = load_settings().await.expect("load settings");

        for key in [
            "locale", "colors", "glass", "radii", "shadows", "animations", "fonts",
            "spacing", "layout", "inputs", "buttons", "tabs", "dropdowns", "cards",
            "editor", "notifications", "perf", "background",
        ] {
            assert!(loaded.get(key).is_some(), "key {} should exist", key);
        }
        assert_eq!(loaded["colors"]["accent"], "#8b5cf6");
        assert_eq!(loaded["glass"]["blur"], 24);
        assert_eq!(loaded["perf"]["qualityLevel"], 100);
        assert_eq!(loaded["background"]["type"], "none");

        teardown_data_dir();
    }

        // ─── custom themes: get / save / load ──────────────────────────────────────

    #[tokio::test]
    #[serial]
    async fn test_get_custom_themes_excludes_builtins_and_base() {
        let _temp = setup_temp_data_dir();

        let data_dir = get_data_dir();
        fs::write(data_dir.join("settings.json"), b"{}").unwrap();
        fs::write(data_dir.join("settings-dark.json"), b"{}").unwrap();
        fs::write(data_dir.join("settings-light.json"), b"{}").unwrap();
        fs::write(data_dir.join("settings-theme-ocean.json"), b"{\"name\":\"ocean\"}").unwrap();
        fs::write(data_dir.join("settings-theme-forest.json"), b"{\"name\":\"forest\"}").unwrap();

        let themes = get_custom_themes().await.expect("get themes");
        assert!(themes.contains(&"ocean".to_string()), "ocean must be listed");
        assert!(themes.contains(&"forest".to_string()), "forest must be listed");
        assert!(!themes.contains(&"settings".to_string()), "settings.json must not be listed");
        assert!(!themes.contains(&"dark".to_string()), "builtin dark must not be listed");
        assert!(!themes.contains(&"light".to_string()), "builtin light must not be listed");

        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_save_and_load_custom_theme() {
        let _temp = setup_temp_data_dir();

        let theme = json!({ "name": "nebula", "colors": { "bg": "#000", "fg": "#fff" } });
        save_custom_theme("nebula".to_string(), theme.clone())
            .await
            .expect("save custom theme");

        let loaded = load_theme("nebula".to_string())
            .await
            .expect("load custom theme");
        assert_eq!(loaded["name"], "nebula");
        assert_eq!(loaded["colors"]["bg"], "#000");

        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_load_theme_builtin() {
        let _temp = setup_temp_data_dir();

        let data_dir = get_data_dir();
        fs::write(
            data_dir.join("settings-dark.json"),
            serde_json::to_string_pretty(&json!({ "name": "dark", "colors": { "bg": "#000", "fg": "#fff" } })).unwrap(),
        )
        .expect("write builtin theme");

        let loaded = load_theme("dark".to_string())
            .await
            .expect("load builtin theme");
        assert_eq!(loaded["name"], "dark");
        assert_eq!(loaded["colors"]["bg"], "#000");

        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_load_theme_unknown_returns_null() {
        let _temp = setup_temp_data_dir();
        let loaded = load_theme("nonexistent_theme".to_string())
            .await
            .expect("load_theme must not panic");
        assert_eq!(loaded, serde_json::Value::Null);
        teardown_data_dir();
    }

    #[tokio::test]
    #[serial]
    async fn test_load_theme_empty_file_returns_null() {
        let _temp = setup_temp_data_dir();

        let data_dir = get_data_dir();
        fs::write(data_dir.join("settings-empty.json"), "").expect("write empty theme");
        let loaded = load_theme("empty".to_string())
            .await
            .expect("load_theme must not panic");
        assert_eq!(loaded, serde_json::Value::Null);

        teardown_data_dir();
    }

        #[tokio::test]
    #[serial]
    async fn test_get_custom_themes_empty_when_fresh() {
        let _temp = setup_temp_data_dir();
        let themes = get_custom_themes().await.expect("get themes");
        assert!(themes.is_empty(), "no themes expected in fresh dir");
        teardown_data_dir();
    }

    // ─── performance: классификация + CSS ────────────────────────────────────────

    #[test]
    fn test_classify_performance_thresholds() {
        use crate::logic::performance::{classify_performance, PerformanceLevel};

        // HIGH: CPU<150, Mem<300, cores>=8
        assert_eq!(classify_performance(149, 299, 8), PerformanceLevel::High);
        // cpu ровно 150 → не High
        assert_ne!(classify_performance(150, 299, 8), PerformanceLevel::High);
        // MEDIUM: CPU<400, Mem<600, cores>=4
        assert_eq!(classify_performance(399, 599, 4), PerformanceLevel::Medium);
        // cpu слишком велик → LOW
        assert_eq!(classify_performance(500, 599, 8), PerformanceLevel::Low);
        // cores мало → LOW
        assert_eq!(classify_performance(100, 100, 2), PerformanceLevel::Low);
    }

    #[test]
    fn test_get_performance_styles_all_branches() {
        let low = get_performance_styles("low".into());
        assert!(low.contains("backdrop-filter: none"), "low CSS");
        let med = get_performance_styles("medium".into());
        assert!(med.contains("backdrop-filter: blur(10px)"), "medium CSS");
        let high = get_performance_styles("high".into());
        assert!(high.is_empty(), "high CSS empty");
        let unknown = get_performance_styles("potato".into());
        assert!(unknown.is_empty(), "unknown defaults to High");
    }

    #[test]
    fn test_run_performance_benchmark_structure() {
        let info = run_performance_benchmark();
        assert!(
            matches!(info.level.as_str(), "low" | "medium" | "high"),
            "level: {}",
            info.level
        );
        assert!(info.cores >= 1, "cores >= 1");
    }

        // ─── DataDirProvider ─────────────────────────────────────────────────────────

    #[test]
    #[serial]
    fn test_custom_data_dir_provider() {
        clear_data_dir_provider();

        let fake = std::path::PathBuf::from("/fake/test/data/path");
        set_data_dir_provider(Box::new(TestDataDirProvider {
            data_dir: fake.clone(),
        }));
        assert_eq!(
            get_data_dir(),
            fake,
            "get_data_dir should return provider path"
        );

        clear_data_dir_provider();
        let after = get_data_dir();
        assert!(
            after.ends_with("data"),
            "after clear should fall back to default"
        );
    }

    #[test]
    fn test_default_data_dir_provider() {
        let dir = DefaultDataDirProvider.get_data_dir();
        assert!(
            dir.ends_with("data"),
            "should end with 'data', got: {}",
            dir.display()
        );
        assert!(!dir.as_os_str().is_empty(), "Path should not be empty");
    }

    // ─── toggle_fullscreen ───────────────────────────────────────────────────────

    #[test]
    fn test_toggle_fullscreen_both_directions() {
        let app = tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![toggle_fullscreen])
            .build(tauri::generate_context!())
            .unwrap();

        let _ = tauri::WebviewWindowBuilder::new(
            &app,
            "toggle-fs",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .build();

        if let Some(win) = app.webview_windows().get("toggle-fs") {
            let r1 = tauri::async_runtime::block_on(toggle_fullscreen(win.clone()));
            assert!(r1.is_ok(), "first toggle must succeed: {:?}", r1.err());
            let r2 = tauri::async_runtime::block_on(toggle_fullscreen(win.clone()));
            assert!(r2.is_ok(), "second toggle must succeed: {:?}", r2.err());
        } else if let Some(win) = app.webview_windows().values().next() {
            let r = tauri::async_runtime::block_on(toggle_fullscreen(win.clone()));
            assert!(r.is_ok(), "toggle must succeed: {:?}", r.err());
        }
    }
}
