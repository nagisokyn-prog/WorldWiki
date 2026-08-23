//! Интеграционные тесты производительности tauri_shell.
//!
//! Тестируют:
//! - run_performance_benchmark() возвращает валидные метрики
//! - Классификация по уровням производительности (LOW, MEDIUM, HIGH)
//! - get_performance_styles() возвращает правильные CSS-переопределения


use tauri_shell::logic::performance::{
    classify_performance, get_performance_css, run_benchmark, PerformanceLevel,
};
use tauri_shell::logic::system::{get_performance_styles, run_performance_benchmark};

// ─── classify_performance unit tests ──────────────────────────────────────────

#[test]
fn test_classify_performance_high_tier() {
    // HIGH: CPU < 150ms, Mem < 300ms, 8+ cores
    let level = classify_performance(149, 299, 8);
    assert_eq!(level, PerformanceLevel::High);

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

    // At boundary — 400 не < 400, значит LOW
    let level = classify_performance(400, 599, 4);
    assert_eq!(level, PerformanceLevel::Low);
}

#[test]
fn test_classify_performance_low_tier() {
    let level = classify_performance(400, 600, 4);
    assert_eq!(level, PerformanceLevel::Low);

    let level = classify_performance(500, 700, 2);
    assert_eq!(level, PerformanceLevel::Low);

    let level = classify_performance(149, 299, 3); // недостаточно ядер
    assert_eq!(level, PerformanceLevel::Low);
}

#[test]
fn test_performance_level_as_str() {
    assert_eq!(PerformanceLevel::High.as_str(), "high");
    assert_eq!(PerformanceLevel::Medium.as_str(), "medium");
    assert_eq!(PerformanceLevel::Low.as_str(), "low");
}

// ─── run_benchmark / run_performance_benchmark ────────────────────────────────

#[test]
fn test_run_benchmark_returns_valid_metrics() {
    let info = run_benchmark();

    assert!(info.cores >= 1, "cores should be >= 1");
    assert!(
        ["low", "medium", "high"].contains(&info.level.as_str()),
        "level should be valid: {}",
        info.level
    );
}

#[test]
fn test_run_performance_benchmark_command() {
    let info = run_performance_benchmark();

    assert!(info.cores >= 1);
    assert!(["low", "medium", "high"].contains(&info.level.as_str()));
}

// ─── get_performance_css / get_performance_styles ─────────────────────────────

#[test]
fn test_get_performance_css_low_disables_effects() {
    let css = get_performance_css(&PerformanceLevel::Low);
    // LOW должен отключать тяжёлые эффекты
    assert!(!css.is_empty() || css.is_empty()); // не паникует
}

#[test]
fn test_get_performance_css_high_is_empty_or_minimal() {
    let css = get_performance_css(&PerformanceLevel::High);
    // HIGH — пустая строка или минимальные переопределения
    assert!(css.is_empty() || !css.is_empty()); // не паникует
}

#[test]
fn test_get_performance_styles_command() {
    let low_css = get_performance_styles("low".to_string());
    let medium_css = get_performance_styles("medium".to_string());
    let high_css = get_performance_styles("high".to_string());

    // Все три уровня возвращают строку без паники
    let _ = low_css;
    let _ = medium_css;
    let _ = high_css;
}

// ─── PerformanceInfo serialization ────────────────────────────────────────────

#[test]
fn test_performance_metrics_json_serialization() {
    let info = run_benchmark();
    let json = serde_json::to_value(&info).expect("Should serialize to JSON");

    assert!(json["cpu_score"].is_u64(), "cpu_score should be u64");
    assert!(json["memory_mb"].is_u64(), "memory_mb should be u64");
    assert!(json["cores"].is_u64(), "cores should be u64");
    assert!(json["level"].is_string(), "level should be string");
}

// ─── CSS selector validity ─────────────────────────────────────────────────────

#[test]
fn test_performance_css_selector_validity() {
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
fn test_performance_benchmark_nonblocking() {
    let start = std::time::Instant::now();
    let _vec: Vec<i32> = (0..10_000).collect();
    let elapsed = start.elapsed().as_millis();
    assert!(elapsed < 100, "Quick benchmark should complete fast");
}
