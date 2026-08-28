#![cfg(feature = "ai-local")]
//! GPU smoke-тесты: реальная загрузка GGUF-моделей на CUDA.
//!
//! Запуск вручную (требует NVIDIA GPU и установленных моделей):
//!   cargo test --test gpu_smoke --features ai-local -- --ignored --test-threads=1
//!
//! Модели ищутся через resolve_model_path (APPDATA/com.worldwiki.app/models).
//! Имена переопределяются переменными окружения WW_GEN_MODEL / WW_EMB_MODEL.
//!
//! Тесты НЕ входят в core-набор: холодный старт CUDA ~30–60 c на модель,
//! нужно реальное железо и последовательное выполнение (общие VRAM-слоты).

use world_wiki_lib::logic::ai::local_llm::{
    get_loaded_embed_slot, get_loaded_model_slot, trigger_cancel_local_gen, LocalLlm,
    ModelParams, TokenEvent,
};

fn gen_model() -> String {
    std::env::var("WW_GEN_MODEL")
        .unwrap_or_else(|_| "Qwen2.5-3B-Instruct-Q4_K_M.gguf".to_string())
}

fn emb_model() -> String {
    std::env::var("WW_EMB_MODEL")
        .unwrap_or_else(|_| "nomic-embed-text-v1.5.Q4_K_M.gguf".to_string())
}

fn light_params() -> ModelParams {
    ModelParams {
        n_ctx: 2048,
        n_batch: 2048,
        n_gpu_layers: 99,
        ..Default::default()
    }
}

/// Мост std::sync::mpsc (API generate_stream) → tokio-канал для await в тесте.
fn spawn_forwarder(
    std_rx: std::sync::mpsc::Receiver<TokenEvent>,
) -> tokio::sync::mpsc::UnboundedReceiver<TokenEvent> {
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<TokenEvent>();
    std::thread::spawn(move || {
        while let Ok(ev) = std_rx.recv() {
            if tx.send(ev).is_err() {
                break;
            }
        }
    });
    rx
}

/// Smoke 1: загрузить embedding-модель → получить embedding → выгрузить.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires CUDA + installed embedding model"]
async fn smoke_1_embedding_roundtrip() {
    let mut m =
        LocalLlm::load_embedding_model(&emb_model(), light_params()).expect("модель загрузилась");

    let vec = m
        .get_embeddings("Артур Пендрагон — король бриттов")
        .expect("embedding должен получиться");
    assert!(!vec.is_empty(), "вектор не пустой");
    assert!(vec.iter().all(|x| x.is_finite()), "компоненты конечны");

    // Выгрузка
    drop(m);
    if let Ok(mut slot) = get_loaded_embed_slot().lock() {
        *slot = None;
    }
}

/// Smoke 2: generation-модель → несколько токенов → выгрузить.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires CUDA + installed generation model"]
async fn smoke_2_generation_produces_tokens() {
    let mut m =
        LocalLlm::load_model(&gen_model(), light_params()).expect("модель загрузилась");

    let (std_tx, std_rx) = std::sync::mpsc::channel::<TokenEvent>();
    let mut rx = spawn_forwarder(std_rx);

    let handle = tokio::task::spawn_blocking(move || {
        m.generate_stream("Расскажи коротко о короле Артуре:", std_tx)
            .expect("генерация не должна падать");
    });

    let mut received = 0usize;
    while let Some(ev) = rx.recv().await {
        if ev.is_done {
            break;
        }
        received += 1;
        if received >= 8 {
            trigger_cancel_local_gen();
        }
    }
    let _ = handle.await;
    assert!(received >= 3, "минимум 3 токена, пришло {received}");

    if let Ok(mut slot) = get_loaded_model_slot().lock() {
        *slot = None;
    }
}

/// Smoke 3: swap — embedder загрузился/выгрузился → generation загрузилась.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires CUDA + both models installed"]
async fn smoke_3_swap_embedder_then_generation() {
    // Фаза A: embedder
    {
        let mut e =
            LocalLlm::load_embedding_model(&emb_model(), light_params()).expect("загрузился");
        let v = e.get_embeddings("тест").expect("embedding ок");
        assert!(!v.is_empty());
        drop(e);
        if let Ok(mut slot) = get_loaded_embed_slot().lock() {
            *slot = None;
        }
    }

    // Фаза B: generation на освободившейся памяти
    {
        let mut g = LocalLlm::load_model(&gen_model(), light_params())
            .expect("generation загрузилась после выгрузки embedder'а");

        let (std_tx, std_rx) = std::sync::mpsc::channel::<TokenEvent>();
        let mut rx = spawn_forwarder(std_rx);
        let h =
            tokio::task::spawn_blocking(move || g.generate_stream("Привет", std_tx).ok());
        let mut got_any = false;
        while let Some(ev) = rx.recv().await {
            if ev.is_done {
                break;
            }
            got_any = true;
            trigger_cancel_local_gen();
        }
        let _ = h.await;
        assert!(got_any, "после swap генерация всё ещё работает");
        if let Ok(mut slot) = get_loaded_model_slot().lock() {
            *slot = None;
        }
    }
}

/// Smoke 4: отмена длинной генерации — стрим завершается после cancel.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires CUDA + installed generation model"]
async fn smoke_4_cancel_stops_generation() {
    let mut m =
        LocalLlm::load_model(&gen_model(), light_params()).expect("модель загрузилась");

    let (std_tx, std_rx) = std::sync::mpsc::channel::<TokenEvent>();
    let mut rx = spawn_forwarder(std_rx);

    let handle = tokio::task::spawn_blocking(move || {
        // Просим много: без отмены генерация шла бы долго
        m.generate_stream(
            "Напиши очень длинный рассказ о драконах, минимум тысяча слов:",
            std_tx,
        )
        .ok();
    });

    // Отменяем сразу после первого токена; ждём завершения не дольше 20 c
    let mut got_first = false;
    loop {
        match tokio::time::timeout(std::time::Duration::from_secs(20), rx.recv()).await {
            Ok(Some(ev)) => {
                if ev.is_done {
                    break;
                }
                if !got_first {
                    got_first = true;
                    trigger_cancel_local_gen();
                }
            }
            Ok(None) => break,
            Err(_) => panic!("отмена не сработала: стрим висит дольше 20 c"),
        }
    }
    assert!(got_first, "до отмены должен прийти хотя бы один токен");
    let _ = handle.await;

    if let Ok(mut slot) = get_loaded_model_slot().lock() {
        *slot = None;
    }
}

/// Smoke 5 (безопасная часть): битые/отсутствующие модели дают понятный Err.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires CUDA (проверяет error-path llama.cpp)"]
async fn smoke_5_broken_and_missing_models_are_clean_errors() {
    // Несуществующий файл
    let err = match LocalLlm::load_model("definitely-not-exists-123456.gguf", light_params()) {
        Ok(_) => panic!("несуществующая модель не может загрузиться"),
        Err(e) => e,
    };
    assert!(
        err.contains("Failed to load model"),
        "понятный текст ошибки: {err}"
    );

    // Файл .gguf с мусорным содержимым
    let dir = std::env::temp_dir().join(format!("ww_smoke5_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let fake = dir.join("fake.gguf");
    std::fs::write(&fake, b"this is not a gguf file at all").unwrap();

    assert!(
        LocalLlm::load_model(&fake.to_string_lossy(), light_params()).is_err(),
        "битый GGUF → Err, не паника"
    );
    assert!(
        LocalLlm::load_embedding_model(&fake.to_string_lossy(), light_params()).is_err(),
        "битый GGUF для embedder → Err, не паника"
    );

    let _ = std::fs::remove_dir_all(dir);
}
