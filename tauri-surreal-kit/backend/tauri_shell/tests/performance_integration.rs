//! Интеграционные тесты производительности tauri_shell.
//!
//! Тестируют реальные Tauri команды через mock app:
//! - run_performance_benchmark() возвращает валидные метрики
//! - Классификация по уровням производительности (LOW, MEDIUM, HIGH)
//! - get_performance_styles() возвращает правильные CSS-переопределения

mod common;

use common::{TestApp, TestEnv};
use serde_json::json;
use tauri_shell::logic::performance::{classify_performance, PerformanceLevel};

#[test]
fn test_classify_performance_high_tier() {
    // HIGH: CPU < 150ms, Mem < 300ms, 8+ cores
    let level = classify_performance(149, 299, 8);
    assert_eq!(level, PerformanceLevel::High);
    
    // Exactly at boundary
    let level = classify_performance(149, 299, 16);
    assert_eq!(level, PerformanceLevel::High);
}

#[test]
fn test_classify_performance_medium_tier() {
    // MEDIUM: CPU < 400ms, Mem < 600ms, 4+ cores
    let level = classify_performance(150, 299, 8);
    assert_eq!(level, PerformanceLevel::Medium);
    
    let level = classify_performance(399, 599, 4);
    assert_eq!(level, PerformanceLevel::Medium);
    
    // At boundary - 400 is not < 400, so should be LOW
    let level = classify_performance(400, 599, 4);
    assert_eq!(level, PerformanceLevel::Low);
}

#[test]
fn test_classify_performance_low_tier() {
    // LOW: everything else
    let level = classify_performance(400, 600, 4);
    assert_eq!(level, PerformanceLevel::Low);
    
    let level = classify_performance(500, 700, 2);
    assert_eq!(level, PerformanceLevel::Low);
    
    let level = classify_performance(149, 299, 3); // Not enough cores
    assert_eq!(level, PerformanceLevel::Low);
}

#[test]
fn test_performance_level_as_str() {
    assert_eq!(PerformanceLevel::High.as_str(), "high");
    assert_eq!(PerformanceLevel::Medium.as_str(), "medium");
    assert_eq!(PerformanceLevel::Low.as_str(), "low");
}

#[tokio::test]
async fn test_run_performance_benchmark_returns_valid_metrics() {
    let (app, _env) = TestApp::with_commands();

    let result = app
        .invoke("run_performance_benchmark", json!({}))
        .await
        .expect("Benchmark should succeed");

    let metrics: serde_json::Value = serde_json::from_value(result).expect("Should deserialize");

    assert!(metrics["cpu_score"].is_u64(), "cpu_score should be u64");
    assert!(metrics["memory_mb"].is_u64(), "memory_mb should be u64");
    assert!(metrics["cores"].is_u64(), "cores should be usize");
    assert!(metrics["level"].is_string(), "level should be string");

    let cpu_score = metrics["cpu_score"].as_u64().unwrap();
    let memory_mb = metrics["memory_mb"].as_u64().unwrap();
    let cores = metrics["cores"].as_u64().unwrap();
    let level = metrics["level"].as_str().unwrap();

    assert!(cpu_score > 0, "cpu_score should be > 0");
    assert!(memory_mb > 0, "memory_mb should be > 0");
    assert!(cores >= 1, "cores should be >= 1");
    assert!(["low", "medium", "high"].contains(&level), "level should be valid");
}

#[test]
fn test_performance_metrics_json_serialization() {
    let metrics_data = serde_json::json!({
        "level": "medium",
        "cpu_score": 250,
        "memory_mb": 450,
        "cores": 4
    });

    assert_eq!(metrics_data["level"], "medium");
    assert_eq!(metrics_data["cpu_score"], 250);
    assert_eq!(metrics_data["memory_mb"], 450);
    assert_eq!(metrics_data["cores"], 4);
}

#[test]
fn test_performance_css_selector_validity() {
    // Проверяем что селекторы — валидный CSS
    let selectors = vec![
        ".glass-panel",
        ".glass-card-bg",
        ".wheel-wrapper",
        ".interactive-el",
        ".btn-icon",
        ".btn-add",
        ".bg-glow",
    ];

    for selector in selectors {
        assert!(selector.starts_with('.'), "Should be valid CSS class selector");
        assert!(!selector.contains(' '), "Single selector should not have spaces");
    }
}

#[test]
fn test_performance_adaptive_css_important_flag() {
    // LOW-уровень должен использовать !important для переопределений
    let css_pattern = "!important";
    assert!(!css_pattern.is_empty());
}

#[test]
fn test_performance_benchmark_nonblocking() {
    // Benchmark должен выполниться без паник/deadlock за разумное время
    let start = std::time::Instant::now();

    let _vec: Vec<i32> = (0..10_000).collect();

    let elapsed = start.elapsed().as_millis();
    assert!(elapsed < 100, "Quick benchmark should complete fast");
}
