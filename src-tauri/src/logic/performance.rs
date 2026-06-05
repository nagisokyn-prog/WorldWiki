use serde::{Serialize, Deserialize};

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

/// Запускаем бенчмарк производительности
/// Тесты оптимизированы для веб-приложений (CSS анимации, DOM, backdrop-filter)
pub fn run_benchmark() -> PerformanceInfo {
    println!("🏃 [BENCH] Запуск бенчмарка...");
    
    // 1. CPU тест - DOM-подобные операции (создание/удаление объектов)
    let start = std::time::Instant::now();
    let mut _vec: Vec<(f64, f64, String)> = Vec::with_capacity(100_000);
    for i in 0..100_000 {
        let x = (i as f64).sin();
        let y = (i as f64).cos();
        let s = format!("item_{}", i % 1000);
        _vec.push((x, y, s));
    }
    let cpu_time = start.elapsed();
    let cpu_score = cpu_time.as_millis() as u64;
    println!("🧮 [BENCH] CPU тест (DOM-like): {}ms", cpu_score);
    
    // 2. Память - аллокация как при рендеринге UI (меньше размер для debug)
    let mem_start = std::time::Instant::now();
    let mut data: Vec<u8> = vec![0; 20_000_000]; // 20MB (было 100MB)
    for chunk in data.chunks_mut(4096) {
        for (i, b) in chunk.iter_mut().enumerate() {
            *b = (i % 256) as u8;
        }
    }
    let mem_time = mem_start.elapsed();
    let memory_mb = mem_time.as_millis() as u64;
    println!("💾 [BENCH] Memory тест (UI render): {}ms", memory_mb);
    drop(data);
    
    // 3. Количество ядер
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(2);
    println!("🔧 [BENCH] Ядер: {}", cores);
    
    // 4. Определяем уровень (пороги для веб-приложений)
    // HIGH: CPU < 150ms, Memory < 300ms, 8+ ядер — всё летает
    // MEDIUM: CPU < 400ms, Memory < 600ms, 4+ ядер — комфортно
    // LOW: всё остальное — нужно упрощать
    let level = if cpu_score < 150 && memory_mb < 300 && cores >= 8 {
        println!("🚀 [BENCH] Уровень: HIGH");
        PerformanceLevel::High
    } else if cpu_score < 400 && memory_mb < 600 && cores >= 4 {
        println!("⚡ [BENCH] Уровень: MEDIUM");
        PerformanceLevel::Medium
    } else {
        println!("🐢 [BENCH] Уровень: LOW");
        PerformanceLevel::Low
    };
    
    PerformanceInfo {
        level: level.as_str().to_string(),
        cpu_score,
        memory_mb,
        cores,
    }
}

/// Получаем настройки CSS/JS для уровня производительности
pub fn get_performance_css(level: &PerformanceLevel) -> String {
    match level {
        PerformanceLevel::Low => {
            // Отключаем всё тяжёлое
            r#"
            .glass-panel, .glass-card-bg, .wheel-wrapper {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            .interactive-el {
                transition: none !important;
            }
            .interactive-el:hover {
                transform: none !important;
            }
            .btn-icon::before, .btn-add::before {
                display: none !important;
            }
            .bg-glow {
                display: none !important;
            }
            "#.to_string()
        }
        PerformanceLevel::Medium => {
            // Отключаем только backdrop-filter
            r#"
            .glass-panel, .glass-card-bg, .wheel-wrapper {
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
            }
            .bg-glow {
                opacity: 0.3 !important;
            }
            "#.to_string()
        }
        PerformanceLevel::High => {
            // Всё включено
            String::new()
        }
    }
}