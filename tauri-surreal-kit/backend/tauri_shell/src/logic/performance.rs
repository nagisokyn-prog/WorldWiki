use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PerformanceLevel {
    Low,
    Medium,
    High,
}

impl PerformanceLevel {
    pub fn as_str(&self) -> &str {
        match self {
            PerformanceLevel::Low => "low",
            PerformanceLevel::Medium => "medium",
            PerformanceLevel::High => "high",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PerformanceInfo {
    pub level: String,
    pub cpu_score: u64,
    pub memory_mb: u64,
    pub cores: usize,
}

/// Классифицирует уровень производительности по сырым метрикам.
/// Чистая функция — легко тестировать граничные пороги без запуска бенчмарка.
/// 
/// Пороги:
/// - HIGH:   CPU < 150ms, Mem < 300ms, 8+ cores
/// - MEDIUM: CPU < 400ms, Mem < 600ms, 4+ cores
/// - LOW:    всё остальное
pub fn classify_performance(cpu_ms: u64, mem_ms: u64, cores: usize) -> PerformanceLevel {
    if cpu_ms < 150 && mem_ms < 300 && cores >= 8 {
        PerformanceLevel::High
    } else if cpu_ms < 400 && mem_ms < 600 && cores >= 4 {
        PerformanceLevel::Medium
    } else {
        PerformanceLevel::Low
    }
}

/// Run a performance benchmark.
/// Tests are tuned for web-app workloads (CSS animations, DOM-like ops, backdrop-filter).
pub fn run_benchmark() -> PerformanceInfo {
    println!("🏃 [BENCH] Running benchmark...");

    // CPU score and memory are now determined entirely by the frontend via UI frame pacing.
    // The Rust backend only provides the core count as an initial hint.
    let cpu_score = 0;
    let memory_mb = 0;

    // 3. CPU cores
    let cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(2);
    println!("🔧 [BENCH] Cores: {}", cores);

    // 4. Determine level via pure function
    let level = classify_performance(cpu_score, memory_mb, cores);

    PerformanceInfo {
        level: level.as_str().to_string(),
        cpu_score,
        memory_mb,
        cores,
    }
}

/// Returns performance-adaptive CSS overrides for a given level.
pub fn get_performance_css(level: &PerformanceLevel) -> String {
    match level {
        PerformanceLevel::Low => r#"
            .glass-panel, .glass-card-bg, .wheel-wrapper {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            .interactive-el { transition: none !important; }
            .interactive-el:hover { transform: none !important; }
            .btn-icon::before, .btn-add::before { display: none !important; }
            .bg-glow { display: none !important; }
        "#
        .to_string(),

        PerformanceLevel::Medium => r#"
            .glass-panel, .glass-card-bg, .wheel-wrapper {
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
            }
            .bg-glow { opacity: 0.3 !important; }
        "#
        .to_string(),

        PerformanceLevel::High => String::new(),
    }
}
