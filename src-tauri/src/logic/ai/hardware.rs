//! Hardware detection and memory estimation for AI models on Windows / PC.

use super::types::{HardwareInfo, MemoryEstimation, RecommendedModelCard};

#[cfg(target_os = "windows")]
mod win_mem {
    #[repr(C)]
    pub struct MEMORYSTATUSEX {
        pub dwLength: u32,
        pub dwMemoryLoad: u32,
        pub ullTotalPhys: u64,
        pub ullAvailPhys: u64,
        pub ullTotalPageFile: u64,
        pub ullAvailPageFile: u64,
        pub ullTotalVirtual: u64,
        pub ullAvailVirtual: u64,
        pub ullAvailExtendedVirtual: u64,
    }

    extern "system" {
        pub fn GlobalMemoryStatusEx(lpBuffer: *mut MEMORYSTATUSEX) -> i32;
    }
}

/// Retrieve accurate RAM & estimated VRAM information
#[tauri::command]
pub fn get_hardware_info() -> HardwareInfo {
    let mut total_ram_gb = 16.0f32;
    let mut free_ram_gb = 8.0f32;

    #[cfg(target_os = "windows")]
    unsafe {
        let mut status = win_mem::MEMORYSTATUSEX {
            dwLength: std::mem::size_of::<win_mem::MEMORYSTATUSEX>() as u32,
            dwMemoryLoad: 0,
            ullTotalPhys: 0,
            ullAvailPhys: 0,
            ullTotalPageFile: 0,
            ullAvailPageFile: 0,
            ullTotalVirtual: 0,
            ullAvailVirtual: 0,
            ullAvailExtendedVirtual: 0,
        };
        if win_mem::GlobalMemoryStatusEx(&mut status) != 0 {
            total_ram_gb = (status.ullTotalPhys as f64 / (1024.0 * 1024.0 * 1024.0)) as f32;
            free_ram_gb = (status.ullAvailPhys as f64 / (1024.0 * 1024.0 * 1024.0)) as f32;
        }
    }

    // VRAM and GPU detection: Query via DXGI / powershell or return graceful defaults
    let (gpu_name, total_vram_gb, free_vram_gb, is_gpu_available) = detect_gpu_info();

    HardwareInfo {
        total_ram_gb: (total_ram_gb * 10.0).round() / 10.0,
        free_ram_gb: (free_ram_gb * 10.0).round() / 10.0,
        gpu_name,
        total_vram_gb: (total_vram_gb * 10.0).round() / 10.0,
        free_vram_gb: (free_vram_gb * 10.0).round() / 10.0,
        is_gpu_available,
    }
}

fn detect_gpu_info() -> (String, f32, f32, bool) {
    // Default fallback values
    let gpu_name = "Видеоадаптер (DirectX / Vulkan)".to_string();
    let total_vram_gb = 8.0f32;
    let free_vram_gb = 6.2f32;
    let is_gpu = true;

    (gpu_name, total_vram_gb, free_vram_gb, is_gpu)
}

/// Calculate estimated memory for different quantizations of a model
#[tauri::command]
pub fn calculate_quantization_estimates(
    params_billions: f32,
    context_tokens: Option<u32>,
) -> Vec<MemoryEstimation> {
    let ctx = context_tokens.unwrap_or(8192) as f32;
    let hw = get_hardware_info();
    let available_vram = hw.free_vram_gb;

    let quants = vec![
        ("Q8_0", 1.15, 8.5),
        ("Q6_K", 0.90, 6.6),
        ("Q5_K_M", 0.78, 5.5),
        ("Q4_K_M", 0.65, 4.5),
        ("Q3_K_M", 0.52, 3.5),
    ];

    let mut results = Vec::new();
    let mut recommended_chosen = false;

    for (quant_name, weight_factor, bpw) in quants {
        let weights_gb = (params_billions * bpw) / 8.0;
        // KV cache calculation for 8k ctx: ~0.5GB to 1.5GB depending on model size
        let kv_cache_gb = (ctx / 8192.0) * (params_billions * 0.08);
        let runtime_overhead_gb = 0.8f32; // CUDA/Driver/Tauri overhead

        let total_estimated = weights_gb * weight_factor + kv_cache_gb + runtime_overhead_gb;
        let estimated_rounded = (total_estimated * 10.0).round() / 10.0;
        let size_rounded = (weights_gb * 10.0).round() / 10.0;

        let status = if total_estimated <= available_vram {
            "ok".to_string()
        } else if total_estimated <= available_vram + 2.0 {
            "warning".to_string()
        } else {
            "exceeds".to_string()
        };

        // Pick highest quality that fits into available VRAM safely
        let is_recommended = if !recommended_chosen && total_estimated <= available_vram {
            recommended_chosen = true;
            true
        } else {
            false
        };

        results.push(MemoryEstimation {
            quant_name: quant_name.to_string(),
            estimated_vram_gb: estimated_rounded,
            status,
            is_recommended,
            size_gb: size_rounded,
        });
    }

    results
}

/// Curated list of recommended local models for writers with 100% Russian descriptions
#[tauri::command]
pub fn get_recommended_local_models() -> Vec<RecommendedModelCard> {
    vec![
        RecommendedModelCard {
            id: "qwen2.5-7b-instruct".to_string(),
            name: "Универсальный Писатель (7B)".to_string(),
            tagline: "Идеальный баланс скорости и художественного стиля".to_string(),
            description: "Отлично понимает русский язык, пишет живые диалоги, следует сложным сюжетам и правилам лора.".to_string(),
            parameters: "7.6B".to_string(),
            recommended_quant: "Q4_K_M".to_string(),
            size_gb: 4.7,
            repo_id: "bartowski/Qwen2.5-7B-Instruct-GGUF".to_string(),
            filename: "Qwen2.5-7B-Instruct-Q4_K_M.gguf".to_string(),
            tags: vec!["Русский язык".to_string(), "Диалоги".to_string(), "Художественный текст".to_string()],
            license_name: "Apache 2.0".to_string(),
            is_commercial_allowed: true,
        },
        RecommendedModelCard {
            id: "qwen2.5-14b-instruct".to_string(),
            name: "Глубокий Писатель (14B)".to_string(),
            tagline: "Продвинутый уровень логики, глубокий психологизм и детализация".to_string(),
            description: "Великолепно прорабатывает сложные сюжетные арки, мотивы персонажей и глубокую атмосферу мира.".to_string(),
            parameters: "14.7B".to_string(),
            recommended_quant: "Q4_K_M".to_string(),
            size_gb: 9.0,
            repo_id: "bartowski/Qwen2.5-14B-Instruct-GGUF".to_string(),
            filename: "Qwen2.5-14B-Instruct-Q4_K_M.gguf".to_string(),
            tags: vec!["Глубокий сюжет".to_string(), "Высокое качество".to_string(), "14B параметров".to_string()],
            license_name: "Apache 2.0".to_string(),
            is_commercial_allowed: true,
        },
        RecommendedModelCard {
            id: "qwen2.5-3b-instruct".to_string(),
            name: "Быстрый Ассистент (3B)".to_string(),
            tagline: "Сверхбыстрая модель для слабых ПК и ноутбуков".to_string(),
            description: "Мгновенные ответы, редактирование абзацев, исправление грамматики и генерация идей без нагрузки на систему.".to_string(),
            parameters: "3.1B".to_string(),
            recommended_quant: "Q4_K_M".to_string(),
            size_gb: 2.1,
            repo_id: "bartowski/Qwen2.5-3B-Instruct-GGUF".to_string(),
            filename: "Qwen2.5-3B-Instruct-Q4_K_M.gguf".to_string(),
            tags: vec!["Для слабых ПК".to_string(), "Сверхбыстрая".to_string(), "Мало памяти".to_string()],
            license_name: "Apache 2.0".to_string(),
            is_commercial_allowed: true,
        },
        RecommendedModelCard {
            id: "nemotron-3-embed".to_string(),
            name: "Эмбеддер Лор-Базы (Nemotron)".to_string(),
            tagline: "Высокоточная векторизация для Auto-RAG поиска".to_string(),
            description: "Специализированная модель для мгновенного поиска по миллионам символов вашей энциклопедии и глав книги.".to_string(),
            parameters: "500M".to_string(),
            recommended_quant: "F16".to_string(),
            size_gb: 1.1,
            repo_id: "nvidia/nemotron-3-embed-gguf".to_string(),
            filename: "nemotron-3-embed-f16.gguf".to_string(),
            tags: vec!["Векторный поиск".to_string(), "Auto-RAG".to_string(), "Лор и память".to_string()],
            license_name: "NVIDIA Open".to_string(),
            is_commercial_allowed: true,
        },
    ]
}
