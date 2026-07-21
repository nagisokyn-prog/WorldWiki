#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use tempfile::TempDir;

    // Helper to create a temporary data directory for testing
    fn setup_test_env() -> TempDir {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let data_dir = temp_dir.path().join("data");
        fs::create_dir_all(&data_dir).expect("Failed to create data dir");
        
        // Set current directory to temp dir for the test
        std::env::set_current_dir(temp_dir.path()).expect("Failed to set current dir");
        
        temp_dir
    }

    #[tokio::test]
    async fn test_save_settings_creates_file() {
        let _temp_dir = setup_test_env();
        
        let settings = json!({
            "locale": "en",
            "colors": {
                "bgBase": "#ffffff"
            },
            "perf": {
                "qualityLevel": 75
            }
        });
        
        let result = save_settings(settings.clone()).await;
        assert!(result.is_ok(), "save_settings should succeed: {:?}", result.err());
        
        // Verify file was created
        let settings_path = std::env::current_dir().unwrap().join("data").join("settings.json");
        assert!(settings_path.exists(), "settings.json should exist");
        
        // Verify content
        let content = fs::read_to_string(&settings_path).expect("Failed to read settings.json");
        let saved: serde_json::Value = serde_json::from_str(&content).expect("Failed to parse JSON");
        assert_eq!(saved["locale"], "en");
        assert_eq!(saved["colors"]["bgBase"], "#ffffff");
        assert_eq!(saved["perf"]["qualityLevel"], 75);
    }

    #[tokio::test]
    async fn test_load_settings_returns_saved() {
        let _temp_dir = setup_test_env();
        
        // First save some settings
        let settings = json!({
            "locale": "fr",
            "colors": {
                "bgBase": "#000000"
            }
        });
        save_settings(settings.clone()).await.expect("Failed to save settings");
        
        // Then load them
        let result = load_settings().await;
        assert!(result.is_ok(), "load_settings should succeed: {:?}", result.err());
        
        let loaded = result.unwrap();
        assert_eq!(loaded["locale"], "fr");
        assert_eq!(loaded["colors"]["bgBase"], "#000000");
    }

    #[tokio::test]
    async fn test_load_settings_returns_null_when_no_file() {
        let _temp_dir = setup_test_env();
        
        // Don't save anything, just try to load
        let result = load_settings().await;
        assert!(result.is_ok(), "load_settings should succeed: {:?}", result.err());
        
        let loaded = result.unwrap();
        assert_eq!(loaded, serde_json::Value::Null);
    }

    #[tokio::test]
    async fn test_save_settings_overwrites_existing() {
        let _temp_dir = setup_test_env();
        
        // Save initial settings
        let initial = json!({"locale": "en", "test": "initial"});
        save_settings(initial).await.expect("Failed to save initial");
        
        // Save new settings
        let updated = json!({"locale": "de", "test": "updated", "newField": 123});
        save_settings(updated.clone()).await.expect("Failed to save updated");
        
        // Load and verify
        let result = load_settings().await.expect("Failed to load");
        assert_eq!(result["locale"], "de");
        assert_eq!(result["test"], "updated");
        assert_eq!(result["newField"], 123);
    }

    #[tokio::test]
    async fn test_load_settings_handles_corrupted_json() {
        let _temp_dir = setup_test_env();
        
        // Write corrupted JSON
        let settings_path = std::env::current_dir().unwrap().join("data").join("settings.json");
        fs::write(&settings_path, "not valid json{").expect("Failed to write corrupted JSON");
        
        // Should handle gracefully and return Null
        let result = load_settings().await;
        assert!(result.is_ok(), "load_settings should not error on corrupted JSON");
        
        let loaded = result.unwrap();
        assert_eq!(loaded, serde_json::Value::Null);
    }

    #[tokio::test]
    async fn test_save_settings_complex_object() {
        let _temp_dir = setup_test_env();
        
        // Test with a complex settings object similar to real AppSettings
        let complex_settings = json!({
            "locale": "ru",
            "colors": {
                "bgBase": "#09090b",
                "bgSecondary": "#121214",
                "bgPanel": "rgba(15,15,18,0.7)",
                "bgInput": "rgba(22,22,26,0.6)",
                "textMain": "#ffffff",
                "textMuted": "rgba(255,255,255,0.65)",
                "textHeading": "#ffffff",
                "accent": "#8b5cf6",
                "accentHover": "#7c3aed",
                "accentActive": "#6d28d9",
                "accentDisabled": "#4c1d95",
                "accentGlow": "rgba(139,92,246,0.3)",
                "accentText": "#ffffff",
                "borderColor": "rgba(255,255,255,0.1)",
                "borderActive": "rgba(139,92,246,0.5)",
                "shadowColor": "rgba(0,0,0,0.5)"
            },
            "glass": {
                "islandAlpha": 0.45,
                "cardAlpha": 0.03,
                "blur": 24,
                "borderAlpha": 0.1,
                "highlight": "rgba(255,255,255,0.08)"
            },
            "perf": {
                "level": "auto",
                "fpsLimit": 60,
                "loadMeter": 0,
                "qualityLevel": 100
            }
        });
        
        let result = save_settings(complex_settings.clone()).await;
        assert!(result.is_ok(), "save_settings should succeed with complex object: {:?}", result.err());
        
        // Load and verify all nested values
        let loaded = load_settings().await.expect("Failed to load");
        assert_eq!(loaded["locale"], "ru");
        assert_eq!(loaded["colors"]["accent"], "#8b5cf6");
        assert_eq!(loaded["glass"]["blur"], 24);
        assert_eq!(loaded["perf"]["qualityLevel"], 100);
    }

    #[tokio::test]
    async fn test_load_theme_returns_null_when_no_file() {
        let _temp_dir = setup_test_env();
        
        let result = load_theme("dark".to_string()).await;
        assert!(result.is_ok(), "load_theme should succeed: {:?}", result.err());
        
        let loaded = result.unwrap();
        assert_eq!(loaded, serde_json::Value::Null);
    }

    #[tokio::test]
    async fn test_load_theme_loads_saved_theme() {
        let _temp_dir = setup_test_env();
        
        // Create theme file manually
        let theme_path = std::env::current_dir().unwrap().join("data").join("settings-theme-dark.json");
        let theme_settings = json!({
            "colors": {
                "bgBase": "#000000",
                "textMain": "#ffffff"
            }
        });
        fs::write(&theme_path, serde_json::to_string_pretty(&theme_settings).unwrap())
            .expect("Failed to write theme file");
        
        let result = load_theme("dark".to_string()).await;
        assert!(result.is_ok(), "load_theme should succeed: {:?}", result.err());
        
        let loaded = result.unwrap();
        assert_eq!(loaded["colors"]["bgBase"], "#000000");
        assert_eq!(loaded["colors"]["textMain"], "#ffffff");
    }

    #[tokio::test]
    async fn test_load_theme_handles_corrupted_json() {
        let _temp_dir = setup_test_env();
        
        // Write corrupted theme file
        let theme_path = std::env::current_dir().unwrap().join("data").join("settings-theme-light.json");
        fs::write(&theme_path, "corrupted{").expect("Failed to write corrupted theme");
        
        let result = load_theme("light".to_string()).await;
        assert!(result.is_ok(), "load_theme should not error on corrupted JSON");
        
        let loaded = result.unwrap();
        assert_eq!(loaded, serde_json::Value::Null);
    }

    #[tokio::test]
    async fn test_save_custom_theme() {
        let _temp_dir = setup_test_env();
        
        let theme_name = "my-custom-theme";
        let theme_settings = json!({
            "colors": {
                "bgBase": "#1a1a2e",
                "accent": "#e94560"
            }
        });
        
        let result = save_custom_theme(theme_name.to_string(), theme_settings.clone()).await;
        assert!(result.is_ok(), "save_custom_theme should succeed: {:?}", result.err());
        
        // Verify file was created
        let theme_path = std::env::current_dir().unwrap().join("data").join(format!("settings-{}.json", theme_name));
        assert!(theme_path.exists(), "Custom theme file should exist");
        
        // Verify content
        let content = fs::read_to_string(&theme_path).expect("Failed to read theme file");
        let loaded: serde_json::Value = serde_json::from_str(&content).expect("Failed to parse theme JSON");
        assert_eq!(loaded["colors"]["bgBase"], "#1a1a2e");
        assert_eq!(loaded["colors"]["accent"], "#e94560");
    }

    #[tokio::test]
    async fn test_get_custom_themes_lists_saved_themes() {
        let _temp_dir = setup_test_env();
        
        // Create a few theme files
        let themes = ["ocean", "forest", "sunset"];
        for theme in &themes {
            let theme_path = std::env::current_dir().unwrap().join("data").join(format!("settings-theme-{}.json", theme));
            fs::write(&theme_path, "{}").expect("Failed to write theme file");
        }
        
        // Also create a non-theme file (should be ignored)
        let other_path = std::env::current_dir().unwrap().join("data").join("settings-other.json");
        fs::write(&other_path, "{}").expect("Failed to write other file");
        
        let result = get_custom_themes().await;
        assert!(result.is_ok(), "get_custom_themes should succeed: {:?}", result.err());
        
        let themes_list = result.unwrap();
        assert_eq!(themes_list.len(), 3);
        assert!(themes_list.contains(&"ocean".to_string()));
        assert!(themes_list.contains(&"forest".to_string()));
        assert!(themes_list.contains(&"sunset".to_string()));
    }

    #[tokio::test]
    async fn test_get_custom_themes_excludes_builtin() {
        let _temp_dir = setup_test_env();
        
        // Create built-in theme files (should be excluded)
        let builtin_themes = ["light", "dark"];
        for theme in &builtin_themes {
            let theme_path = std::env::current_dir().unwrap().join("data").join(format!("settings-theme-{}.json", theme));
            fs::write(&theme_path, "{}").expect("Failed to write builtin theme file");
        }
        
        // Create custom theme
        let custom_path = std::env::current_dir().unwrap().join("data").join("settings-theme-custom.json");
        fs::write(&custom_path, "{}").expect("Failed to write custom theme file");
        
        let result = get_custom_themes().await;
        assert!(result.is_ok(), "get_custom_themes should succeed: {:?}", result.err());
        
        let themes_list = result.unwrap();
        assert_eq!(themes_list.len(), 1);
        assert!(themes_list.contains(&"custom".to_string()));
        assert!(!themes_list.contains(&"light".to_string()));
        assert!(!themes_list.contains(&"dark".to_string()));
    }

    #[tokio::test]
    async fn test_get_custom_themes_returns_empty_when_no_themes() {
        let _temp_dir = setup_test_env();
        
        let result = get_custom_themes().await;
        assert!(result.is_ok(), "get_custom_themes should succeed: {:?}", result.err());
        
        let themes_list = result.unwrap();
        assert_eq!(themes_list.len(), 0);
    }

    #[tokio::test]
    async fn test_settings_roundtrip_preserves_all_fields() {
        let _temp_dir = setup_test_env();
        
        // Save a comprehensive settings object
        let original = json!({
            "locale": "en",
            "colors": {
                "bgBase": "#09090b",
                "bgSecondary": "#121214",
                "bgPanel": "rgba(15,15,18,0.7)",
                "bgInput": "rgba(22,22,26,0.6)",
                "textMain": "#ffffff",
                "textMuted": "rgba(255,255,255,0.65)",
                "textHeading": "#ffffff",
                "accent": "#8b5cf6",
                "accentHover": "#7c3aed",
                "accentActive": "#6d28d9",
                "accentDisabled": "#4c1d95",
                "accentGlow": "rgba(139,92,246,0.3)",
                "accentText": "#ffffff",
                "borderColor": "rgba(255,255,255,0.1)",
                "borderActive": "rgba(139,92,246,0.5)",
                "shadowColor": "rgba(0,0,0,0.5)"
            },
            "glass": {
                "islandAlpha": 0.45,
                "cardAlpha": 0.03,
                "blur": 24,
                "borderAlpha": 0.1,
                "highlight": "rgba(255,255,255,0.08)"
            },
            "radii": {
                "island": 28,
                "card": 20,
                "btn": 40,
                "input": 16,
                "dropdown": 16
            },
            "shadows": {
                "islandY": 20,
                "islandBlur": 35,
                "useInset": false
            },
            "animations": {
                "enabled": true,
                "speed": 0.3,
                "ease": "cubic-bezier(0.2,0.8,0.2,1)",
                "entrance": 0.4,
                "pulse": true,
                "scalePush": 0.98,
                "scalePull": 1.05
            },
            "fonts": {
                "family": "Inter",
                "size": 14,
                "weight": 400,
                "weightBold": 600,
                "lineHeight": 1.5,
                "letterSpacing": 0
            },
            "spacing": {
                "density": 1,
                "sidebarWidth": 280,
                "panelHeight": 250,
                "activityBarWidth": 60,
                "toolbarHeight": 48,
                "gap": 16
            },
            "layout": {
                "columns": 2,
                "sidebarPos": "row",
                "tabPos": "row",
                "focusMode": false
            },
            "inputs": {
                "style": "outline",
                "focusAnim": true
            },
            "buttons": {
                "hoverScale": true,
                "clickPress": true
            },
            "tabs": {
                "pos": "row"
            },
            "dropdowns": {
                "use3DWheel": true,
                "wheelOrientation": "vertical"
            },
            "cards": {
                "compactList": false,
                "showIcons": true
            },
            "editor": {
                "showWordCount": true,
                "requireCtrlForLinks": false,
                "autoSaveInterval": 60,
                "snapshotInterval": 15,
                "maxSnapshots": 10
            },
            "notifications": {
                "duration": 3000,
                "position": "bottom-right"
            },
            "perf": {
                "level": "auto",
                "fpsLimit": 60,
                "loadMeter": 0,
                "qualityLevel": 100
            },
            "background": {
                "type": "none",
                "opacity": 1,
                "blur": 0,
                "fit": "cover",
                "fpsLimit": 30
            }
        });
        
        // Save
        let save_result = save_settings(original.clone()).await;
        assert!(save_result.is_ok(), "Save should succeed: {:?}", save_result.err());
        
        // Load
        let load_result = load_settings().await;
        assert!(load_result.is_ok(), "Load should succeed: {:?}", load_result.err());
        
        let loaded = load_result.unwrap();
        
        // Verify all top-level keys exist
        assert!(loaded.get("locale").is_some());
        assert!(loaded.get("colors").is_some());
        assert!(loaded.get("glass").is_some());
        assert!(loaded.get("radii").is_some());
        assert!(loaded.get("shadows").is_some());
        assert!(loaded.get("animations").is_some());
        assert!(loaded.get("fonts").is_some());
        assert!(loaded.get("spacing").is_some());
        assert!(loaded.get("layout").is_some());
        assert!(loaded.get("inputs").is_some());
        assert!(loaded.get("buttons").is_some());
        assert!(loaded.get("tabs").is_some());
        assert!(loaded.get("dropdowns").is_some());
        assert!(loaded.get("cards").is_some());
        assert!(loaded.get("editor").is_some());
        assert!(loaded.get("notifications").is_some());
        assert!(loaded.get("perf").is_some());
        assert!(loaded.get("background").is_some());
        
        // Verify specific values
        assert_eq!(loaded["locale"], "en");
        assert_eq!(loaded["colors"]["accent"], "#8b5cf6");
        assert_eq!(loaded["glass"]["blur"], 24);
        assert_eq!(loaded["perf"]["qualityLevel"], 100);
        assert_eq!(loaded["background"]["type"], "none");
    }
}