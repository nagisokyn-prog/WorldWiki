//! Hardware detection and memory estimation for AI models on Windows / PC.

use super::types::{HardwareInfo, MemoryEstimation, RecommendedModelCard};

#[cfg(target_os = "windows")]
#[allow(non_snake_case, non_camel_case_types, clippy::upper_case_acronyms)]
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

#[cfg(target_os = "windows")]
mod win_gpu {
    use std::ffi::c_void;

    #[repr(C)]
    pub struct DXGI_ADAPTER_DESC {
        pub description: [u16; 128],
        pub vendor_id: u32,
        pub device_id: u32,
        pub sub_sys_id: u32,
        pub revision: u32,
        pub dedicated_video_memory: usize,
        pub dedicated_system_memory: usize,
        pub shared_system_memory: usize,
        pub adapter_luid: u64,
    }

    extern "system" {
        pub fn LoadLibraryA(lpLibFileName: *const u8) -> *mut c_void;
        pub fn GetProcAddress(hModule: *mut c_void, lpProcName: *const u8) -> *mut c_void;
        pub fn FreeLibrary(hLibModule: *mut c_void) -> i32;
    }

    type CreateDXGIFactoryFn = unsafe extern "system" fn(
        riid: *const [u8; 16],
        pp_factory: *mut *mut c_void,
    ) -> i32;

    const IID_IDXGI_FACTORY: [u8; 16] = [
        0xec, 0x66, 0x71, 0x7b, 0xc7, 0x21, 0xae, 0x44, 0xb2, 0x1a, 0xc9, 0xae, 0x32, 0x1a, 0xe3, 0x69,
    ];

    pub fn query_dxgi_gpu() -> Option<(String, f32)> {
        unsafe {
            let h_dxgi = LoadLibraryA(c"dxgi.dll".as_ptr().cast());
            if h_dxgi.is_null() {
                return None;
            }
            let p_fn = GetProcAddress(h_dxgi, c"CreateDXGIFactory".as_ptr().cast());
            if p_fn.is_null() {
                FreeLibrary(h_dxgi);
                return None;
            }
            let create_factory: CreateDXGIFactoryFn = std::mem::transmute(p_fn);
            let mut factory_ptr: *mut c_void = std::ptr::null_mut();
            if create_factory(&IID_IDXGI_FACTORY, &mut factory_ptr) != 0 || factory_ptr.is_null() {
                FreeLibrary(h_dxgi);
                return None;
            }

            let vtable = *(factory_ptr as *mut *mut usize);
            let enum_adapters: unsafe extern "system" fn(*mut c_void, u32, *mut *mut c_void) -> i32 =
                std::mem::transmute(*vtable.add(7));

            let mut adapter_ptr: *mut c_void = std::ptr::null_mut();
            let mut result = None;

            if enum_adapters(factory_ptr, 0, &mut adapter_ptr) == 0 && !adapter_ptr.is_null() {
                let adapter_vtable = *(adapter_ptr as *mut *mut usize);
                let get_desc: unsafe extern "system" fn(*mut c_void, *mut DXGI_ADAPTER_DESC) -> i32 =
                    std::mem::transmute(*adapter_vtable.add(8));

                let mut desc: DXGI_ADAPTER_DESC = std::mem::zeroed();
                if get_desc(adapter_ptr, &mut desc) == 0 {
                    let len = desc.description.iter().position(|&c| c == 0).unwrap_or(desc.description.len());
                    let name = String::from_utf16_lossy(&desc.description[..len]).trim().to_string();
                    let vram_gb = (desc.dedicated_video_memory as f64 / (1024.0 * 1024.0 * 1024.0)) as f32;
                    if !name.is_empty() {
                        result = Some((name, vram_gb));
                    }
                }
                let release_adapter: unsafe extern "system" fn(*mut c_void) -> u32 = std::mem::transmute(*adapter_vtable.add(2));
                release_adapter(adapter_ptr);
            }

            let release_factory: unsafe extern "system" fn(*mut c_void) -> u32 = std::mem::transmute(*vtable.add(2));
            release_factory(factory_ptr);
            FreeLibrary(h_dxgi);

            result
        }
    }
}

fn detect_gpu_info() -> (String, f32, f32, bool) {
    #[cfg(target_os = "windows")]
    if let Some((name, total_vram_gb)) = win_gpu::query_dxgi_gpu() {
        let is_gpu = total_vram_gb >= 0.5;
        let free_vram_gb = if total_vram_gb > 0.0 {
            (total_vram_gb * 0.82).max(0.5)
        } else {
            0.0
        };
        return (name, total_vram_gb, free_vram_gb, is_gpu);
    }

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
            id: "nomic-embed-text".to_string(),
            name: "Эмбеддер Лор-Базы (Nomic)".to_string(),
            tagline: "Высокоточная векторизация для Auto-RAG поиска".to_string(),
            description: "Специализированная модель для мгновенного поиска по миллионам символов вашей энциклопедии и глав книги.".to_string(),
            parameters: "137M".to_string(),
            recommended_quant: "Q4_K_M".to_string(),
            size_gb: 0.3,
            repo_id: "nomic-ai/nomic-embed-text-v1.5-GGUF".to_string(),
            filename: "nomic-embed-text-v1.5.Q4_K_M.gguf".to_string(),
            tags: vec!["Векторный поиск".to_string(), "Auto-RAG".to_string(), "Лор и память".to_string()],
            license_name: "Apache 2.0".to_string(),
            is_commercial_allowed: true,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- calculate_quantization_estimates ----------

    #[test]
    fn returns_all_five_quant_variants_in_order() {
        let est = calculate_quantization_estimates(7.0, Some(8192));
        let names: Vec<&str> = est.iter().map(|e| e.quant_name.as_str()).collect();
        assert_eq!(names, vec!["Q8_0", "Q6_K", "Q5_K_M", "Q4_K_M", "Q3_K_M"]);
    }

    #[test]
    fn default_context_is_8k() {
        let with_none = calculate_quantization_estimates(7.0, None);
        let explicit = calculate_quantization_estimates(7.0, Some(8192));
        assert_eq!(
            with_none.iter().map(|e| e.estimated_vram_gb).collect::<Vec<_>>(),
            explicit.iter().map(|e| e.estimated_vram_gb).collect::<Vec<_>>(),
            "None должен быть эквивалентен 8192 токенов контекста"
        );
    }

    #[test]
    fn estimates_are_monotonically_decreasing_by_quant() {
        let est = calculate_quantization_estimates(14.0, Some(16384));
        for w in est.windows(2) {
            assert!(
                w[0].estimated_vram_gb >= w[1].estimated_vram_gb,
                "Q8_0 должен требовать не меньше VRAM, чем Q6_K и т.д."
            );
            assert!(
                w[0].size_gb >= w[1].size_gb,
                "размер весов тоже монотонно убывает"
            );
        }
    }

    #[test]
    fn larger_context_needs_more_vram() {
        let small = calculate_quantization_estimates(7.0, Some(2048));
        let large = calculate_quantization_estimates(7.0, Some(32768));
        for (s, l) in small.iter().zip(large.iter()) {
            assert!(
                l.estimated_vram_gb >= s.estimated_vram_gb,
                "больший контекст → не меньше VRAM ({})", s.quant_name
            );
        }
    }

    #[test]
    fn status_values_are_valid_and_at_most_one_recommended() {
        let est = calculate_quantization_estimates(30.0, Some(8192));
        for e in &est {
            assert!(
                matches!(e.status.as_str(), "ok" | "warning" | "exceeds"),
                "невалидный статус: {}", e.status
            );
            assert!(e.estimated_vram_gb > 0.0);
            assert!(e.size_gb > 0.0);
        }
        let recommended_count = est.iter().filter(|e| e.is_recommended).count();
        assert!(recommended_count <= 1, "рекомендация максимум одна");
    }

    #[test]
    fn tiny_model_gets_recommended_top_quality() {
        // 0.1B параметров помещается в любую VRAM → самый качественный квант рекомендован
        let est = calculate_quantization_estimates(0.1, Some(512));
        assert!(est[0].is_recommended, "Q8_0 для крошечной модели должен быть ok+recommended");
        assert_eq!(est[0].status, "ok");
    }

    // ---------- get_hardware_info / get_recommended_local_models ----------

    #[test]
    fn hardware_info_smoke_no_panic_sane_values() {
        let hw = get_hardware_info();
        assert!(hw.total_ram_gb > 0.0, "RAM должна определяться положительной");
        assert!(hw.free_ram_gb >= 0.0 && hw.free_ram_gb <= hw.total_ram_gb);
        if hw.is_gpu_available {
            assert!(hw.total_vram_gb >= 0.0);
            assert!(!hw.gpu_name.is_empty(), "GPU доступен, но имя пустое");
        }
    }

    #[test]
    fn recommended_models_catalog_is_consistent() {
        let models = get_recommended_local_models();
        assert!(models.len() >= 4, "каталог не пуст");

        let mut ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), models.len(), "id уникальны");

        for m in &models {
            assert!(m.filename.to_lowercase().ends_with(".gguf"), "файл модели .gguf: {}", m.filename);
            assert!(m.size_gb > 0.0);
            assert!(!m.name.is_empty());
            assert!(!m.repo_id.is_empty());
            assert!(!m.recommended_quant.is_empty());
            assert!(m.is_commercial_allowed, "в каталоге только commercial-ok модели");
            assert!(!m.tags.is_empty());
        }

        // Есть эмбеддер для Auto-RAG
        assert!(
            models.iter().any(|m| m.id.contains("embed") || m.filename.contains("embed")),
            "в каталоге должен быть embedding-модели"
        );
    }
}
