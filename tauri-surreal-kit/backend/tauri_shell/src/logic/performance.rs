use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
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

    // 1. CPU — DOM-like object create/drop
    let start = std::time::Instant::now();
    let mut _vec: Vec<(f64, f64, String)> = Vec::with_capacity(100_000);
    for i in 0..100_000 {
        let x = (i as f64).sin();
        let y = (i as f64).cos();
        let s = format!("item_{}", i % 1000);
        _vec.push((x, y, s));
    }
    let cpu_score = start.elapsed().as_millis() as u64;
    println!("🧮 [BENCH] CPU (DOM-like): {}ms", cpu_score);

    // 2. Memory — UI render simulation (20MB alloc + touch)
    let mem_start = std::time::Instant::now();
    let mut data: Vec<u8> = vec![0; 20_000_000];
    for chunk in data.chunks_mut(4096) {
        for (i, b) in chunk.iter_mut().enumerate() {
            *b = (i % 256) as u8;
        }
    }
    let memory_mb = mem_start.elapsed().as_millis() as u64;
    println!("💾 [BENCH] Memory (UI render): {}ms", memory_mb);
    drop(data);

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
