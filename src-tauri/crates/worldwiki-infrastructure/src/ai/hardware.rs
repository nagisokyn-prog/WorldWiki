use worldwiki_domain::ai::{HardwareInfo, MemoryEstimation, RecommendedModelCard};
use worldwiki_ports::ai::HardwareDetectorPort;

#[cfg(target_os = "windows")]
mod win_mem {
    #[repr(C)]
    pub struct MemoryStatusEx {
        pub dw_length: u32,
        pub dw_memory_load: u32,
        pub ull_total_phys: u64,
        pub ull_avail_phys: u64,
        pub ull_total_page_file: u64,
        pub ull_avail_page_file: u64,
        pub ull_total_virtual: u64,
        pub ull_avail_virtual: u64,
        pub ull_avail_extended_virtual: u64,
    }

    // SAFETY: FFI declaration for WinAPI GlobalMemoryStatusEx.
    extern "system" {
        #[link_name = "GlobalMemoryStatusEx"]
        pub fn global_memory_status_ex(lp_buffer: *mut MemoryStatusEx) -> i32;
    }
}

#[cfg(target_os = "windows")]
mod win_gpu {
    use std::ffi::c_void;

    #[repr(C)]
    pub struct DxgiAdapterDesc {
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

    // SAFETY: FFI declarations for kernel32 DLL loading APIs.
    extern "system" {
        pub fn LoadLibraryA(lp_lib_file_name: *const u8) -> *mut c_void;
        pub fn GetProcAddress(h_module: *mut c_void, lp_proc_name: *const u8) -> *mut c_void;
        pub fn FreeLibrary(h_lib_module: *mut c_void) -> i32;
    }

    // SAFETY: IDXGIFactory instantiation function pointer type matching Windows DXGI ABI.
    type CreateDXGIFactoryFn = unsafe extern "system" fn(riid: *const [u8; 16], pp_factory: *mut *mut c_void) -> i32;

    // SAFETY: IDXGIFactory::EnumAdapters COM slot function pointer type.
    type EnumAdaptersFn = unsafe extern "system" fn(*mut c_void, u32, *mut *mut c_void) -> i32;

    // SAFETY: IDXGIAdapter::GetDesc COM slot function pointer type.
    type GetDescFn = unsafe extern "system" fn(*mut c_void, *mut DxgiAdapterDesc) -> i32;

    // SAFETY: IUnknown::Release COM slot function pointer type.
    type ReleaseFn = unsafe extern "system" fn(*mut c_void) -> u32;

    const IID_IDXGI_FACTORY: [u8; 16] = [
        0xec, 0x66, 0x71, 0x7b, 0xc7, 0x21, 0xae, 0x44, 0xb2, 0x1a, 0xc9, 0xae, 0x32, 0x1a, 0xe3,
        0x69,
    ];

    pub fn query_dxgi_gpu() -> Option<(String, f32)> {
        // SAFETY: Загрузка стандартной системной библиотеки dxgi.dll и вызов CreateDXGIFactory
        // через валидный указатель интерфейса IID_IDXGI_FACTORY. Дескрипторы и COM-указатели
        // освобождаются симметрично через FreeLibrary и release-методы vtable.
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
            let enum_adapters: EnumAdaptersFn = std::mem::transmute(*vtable.add(7));

            let mut adapter_ptr: *mut c_void = std::ptr::null_mut();
            let mut result = None;

            if enum_adapters(factory_ptr, 0, &mut adapter_ptr) == 0 && !adapter_ptr.is_null() {
                let adapter_vtable = *(adapter_ptr as *mut *mut usize);
                let get_desc: GetDescFn = std::mem::transmute(*adapter_vtable.add(8));

                let mut desc: DxgiAdapterDesc = std::mem::zeroed();
                if get_desc(adapter_ptr, &mut desc) == 0 {
                    let len = desc
                        .description
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(desc.description.len());
                    let slice = desc.description.get(..len).unwrap_or(&desc.description);
                    let name = String::from_utf16_lossy(slice)
                        .trim()
                        .to_string();
                    let vram_gb =
                        (desc.dedicated_video_memory as f64 / (1024.0 * 1024.0 * 1024.0)) as f32;
                    if !name.is_empty() {
                        result = Some((name, vram_gb));
                    }
                }
                let release_adapter: ReleaseFn = std::mem::transmute(*adapter_vtable.add(2));
                release_adapter(adapter_ptr);
            }

            let release_factory: ReleaseFn = std::mem::transmute(*vtable.add(2));
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

#[derive(Default, Clone)]
pub struct WinApiHardwareDetector;

impl WinApiHardwareDetector {
    pub fn new() -> Self {
        Self
    }
}

impl HardwareDetectorPort for WinApiHardwareDetector {
    fn get_hardware_info(&self) -> HardwareInfo {
        let mut total_ram_gb = 16.0f32;
        let mut free_ram_gb = 8.0f32;

        #[cfg(target_os = "windows")]
        // SAFETY: Структура MemoryStatusEx аллоцирована на стеке, dw_length строго инициализирована
        // размером структуры sizeof(MemoryStatusEx). WinAPI GlobalMemoryStatusEx выполняет только запись.
        unsafe {
            let mut status = win_mem::MemoryStatusEx {
                dw_length: std::mem::size_of::<win_mem::MemoryStatusEx>() as u32,
                dw_memory_load: 0,
                ull_total_phys: 0,
                ull_avail_phys: 0,
                ull_total_page_file: 0,
                ull_avail_page_file: 0,
                ull_total_virtual: 0,
                ull_avail_virtual: 0,
                ull_avail_extended_virtual: 0,
            };
            if win_mem::global_memory_status_ex(&mut status) != 0 {
                total_ram_gb = (status.ull_total_phys as f64 / (1024.0 * 1024.0 * 1024.0)) as f32;
                free_ram_gb = (status.ull_avail_phys as f64 / (1024.0 * 1024.0 * 1024.0)) as f32;
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

    fn calculate_quantization_estimates(
        &self,
        params_billions: f32,
        context_tokens: Option<usize>,
    ) -> Vec<MemoryEstimation> {
        let ctx = context_tokens.unwrap_or(8192) as f32;
        let hw = self.get_hardware_info();
        let total_vram = hw.total_vram_gb;

        let quants = vec![
            ("Q4_K_M", 0.58f32, "Оптимальный баланс качества и скорости"),
            ("Q5_K_M", 0.70f32, "Повышенная точность русского языка"),
            ("Q8_0", 1.05f32, "Максимальная точность (близко к FP16)"),
            ("Q3_K_M", 0.46f32, "Минимальный вес для слабых GPU"),
        ];

        quants
            .into_iter()
            .map(|(quant_name, bpw_multiplier, _desc)| {
                let model_weight_gb = params_billions * bpw_multiplier;
                let kv_cache_gb = (ctx * 2.0 * 40.0 * 128.0 * 2.0) / (1024.0 * 1024.0 * 1024.0);
                let overhead_gb = 0.6f32;
                let estimated_vram_gb = model_weight_gb + kv_cache_gb + overhead_gb;

                let status = if estimated_vram_gb <= total_vram * 0.85 {
                    "ok".to_string()
                } else if estimated_vram_gb <= total_vram {
                    "warning".to_string()
                } else {
                    "exceeds".to_string()
                };

                let is_recommended = quant_name == "Q4_K_M" && status != "exceeds";

                MemoryEstimation {
                    quant_name: quant_name.to_string(),
                    estimated_vram_gb: (estimated_vram_gb * 10.0).round() / 10.0,
                    status,
                    is_recommended,
                    size_gb: (model_weight_gb * 10.0).round() / 10.0,
                }
            })
            .collect()
        }

    fn get_recommended_local_models(&self) -> Vec<RecommendedModelCard> {
        vec![
            RecommendedModelCard {
                id: "saiga_llama3_8b".to_string(),
                name: "Saiga / Llama 3 8B".to_string(),
                tagline: "Идеально для русского фэнтези и стилизации".to_string(),
                description: "Лучшая русскоязычная модель среднего размера для литературного текста и генерации лора.".to_string(),
                parameters: "8B".to_string(),
                recommended_quant: "Q4_K_M".to_string(),
                size_gb: 4.9,
                repo_id: "IlyaGusev/saiga_llama3_8b_gguf".to_string(),
                filename: "model-q4_K.gguf".to_string(),
                tags: vec!["Русский".to_string(), "Соавтор".to_string(), "Лор".to_string()],
                license_name: "Llama 3 Community".to_string(),
                is_commercial_allowed: true,
            },
            RecommendedModelCard {
                id: "qwen2.5_7b_instruct".to_string(),
                name: "Qwen 2.5 7B Instruct".to_string(),
                tagline: "Мощная логика, сюжетные арки и поиск противоречий".to_string(),
                description: "Высокая точность следования сложным инструкциям и проверка фактов по энциклопедии.".to_string(),
                parameters: "7B".to_string(),
                recommended_quant: "Q4_K_M".to_string(),
                size_gb: 4.7,
                repo_id: "Qwen/Qwen2.5-7B-Instruct-GGUF".to_string(),
                filename: "qwen2.5-7b-instruct-q4_k_m.gguf".to_string(),
                tags: vec!["Логика".to_string(), "Анализ".to_string(), "Чеховские ружья".to_string()],
                license_name: "Apache 2.0".to_string(),
                is_commercial_allowed: true,
            },
            RecommendedModelCard {
                id: "bge_m3_embed".to_string(),
                name: "BAAI BGE-M3 (Embeddings)".to_string(),
                tagline: "Мультиязычный семантический векторный поиск".to_string(),
                description: "Быстрое индексирование энциклопедии мира и сопоставление сущностей в тексте.".to_string(),
                parameters: "0.5B".to_string(),
                recommended_quant: "FP16".to_string(),
                size_gb: 1.1,
                repo_id: "BAAI/bge-m3".to_string(),
                filename: "bge-m3-fp16.gguf".to_string(),
                tags: vec!["Эмбеддинги".to_string(), "RAG".to_string(), "Векторы".to_string()],
                license_name: "MIT".to_string(),
                is_commercial_allowed: true,
            },
        ]
    }
}
