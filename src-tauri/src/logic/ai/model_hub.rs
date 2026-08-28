//! Model Hub: Hugging Face integration for browsing and downloading GGUF models.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct HfModelCard {
    pub id: String,
    pub author: Option<String>,
    pub name: String,
    pub downloads: u64,
    pub likes: u64,
    pub tags: Vec<String>,
    pub gguf_files: Vec<GgufFileInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct GgufFileInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub size_gb: f32,
    pub quantization: String,
}

#[derive(Debug, Deserialize)]
struct HfApiResponseItem {
    id: String,
    #[serde(default)]
    author: Option<String>,
    #[serde(default)]
    downloads: Option<u64>,
    #[serde(default)]
    likes: Option<u64>,
    #[serde(default)]
    tags: Option<Vec<String>>,
    #[serde(default)]
    siblings: Option<Vec<HfSibling>>,
}

#[derive(Debug, Deserialize)]
struct HfSibling {
    rfilename: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DownloadProgressEvent {
    pub repo_id: String,
    pub filename: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: f32,
    pub is_done: bool,
    pub error: Option<String>,
}

/// Fetch popular or searched GGUF models from Hugging Face
#[tauri::command]
pub async fn fetch_hf_models(
    query: Option<String>,
    token: Option<String>,
) -> Result<Vec<HfModelCard>, String> {
    fetch_hf_models_inner(query.as_deref(), token.as_deref(), None).await
}

/// Тестируемое ядро каталога HF (base_override — для мок-сервера).
pub async fn fetch_hf_models_inner(
    query: Option<&str>,
    token: Option<&str>,
    base_override: Option<&str>,
) -> Result<Vec<HfModelCard>, String> {
    let search_part = if let Some(q) = query {
        if !q.trim().is_empty() {
            let encoded: String = q
                .trim()
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c.to_string() } else { format!("%{:02X}", c as u32) })
                .collect();
            format!("&search={encoded}")
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    let hf_base = base_override.unwrap_or("https://huggingface.co");
    let url = format!("{hf_base}/api/models?filter=gguf&sort=downloads&direction=-1&limit=40&full=true{search_part}");

    let client = Client::new();
    let mut req = client
        .get(&url)
        .header("User-Agent", "WorldWiki/1.0");

    if let Some(tok) = token {
        let t = tok.trim();
        if !t.is_empty() {
            req = req.header("Authorization", format!("Bearer {t}"));
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Ошибка подключения к Hugging Face: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Hugging Face вернул ошибку: {}", resp.status()));
    }

    let items: Vec<HfApiResponseItem> = resp.json().await.map_err(|e| format!("Ошибка парсинга ответа Hugging Face: {e}"))?;

    let mut result = Vec::new();
    for item in items {
        let mut gguf_files = Vec::new();
        if let Some(siblings) = item.siblings {
            for sib in siblings {
                if sib.rfilename.to_lowercase().ends_with(".gguf") {
                    let quant = detect_quant_from_filename(&sib.rfilename);
                    gguf_files.push(GgufFileInfo {
                        filename: sib.rfilename,
                        size_bytes: 0,
                        size_gb: 0.0,
                        quantization: quant,
                    });
                }
            }
        }

        let name = item.id.split('/').next_back().unwrap_or(&item.id).to_string();
        result.push(HfModelCard {
            id: item.id,
            author: item.author,
            name,
            downloads: item.downloads.unwrap_or(0),
            likes: item.likes.unwrap_or(0),
            tags: item.tags.unwrap_or_default(),
            gguf_files,
        });
    }

    Ok(result)
}

fn detect_quant_from_filename(filename: &str) -> String {
    let upper = filename.to_uppercase();
    if upper.contains("TURBO3_TCQ") || upper.contains("TCQ") {
        "TCQ (2.25-bit)".to_string()
    } else if upper.contains("TURBO2") || upper.contains("TQ1") {
        "TurboQuant 2-bit".to_string()
    } else if upper.contains("TURBO3") {
        "TurboQuant 3-bit".to_string()
    } else if upper.contains("TURBO4") || upper.contains("TQ2") {
        "TurboQuant 4-bit".to_string()
    } else if upper.contains("Q4_K_M") {
        "Q4_K_M".to_string()
    } else if upper.contains("Q4_K_S") {
        "Q4_K_S".to_string()
    } else if upper.contains("Q5_K_M") {
        "Q5_K_M".to_string()
    } else if upper.contains("Q8_0") {
        "Q8_0".to_string()
    } else if upper.contains("BF16") || upper.contains("F16") {
        "F16".to_string()
    } else {
        "GGUF".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_standard_quants() {
        assert_eq!(detect_quant_from_filename("model-Q4_K_M.gguf"), "Q4_K_M");
        assert_eq!(detect_quant_from_filename("model-Q4_K_S.gguf"), "Q4_K_S");
        assert_eq!(detect_quant_from_filename("model-Q5_K_M.gguf"), "Q5_K_M");
        assert_eq!(detect_quant_from_filename("model-q8_0.gguf"), "Q8_0");
    }

    #[test]
    fn case_insensitive() {
        assert_eq!(detect_quant_from_filename("MODEL-q4_k_m.GGUF"), "Q4_K_M");
        assert_eq!(detect_quant_from_filename("QwEn-Q8_0-Instruct.gguf"), "Q8_0");
    }

    #[test]
    fn detects_turboquant_family() {
        assert_eq!(detect_quant_from_filename("nemotron-TURBO3_TCQ.gguf"), "TCQ (2.25-bit)");
        assert_eq!(detect_quant_from_filename("x_TCQ_y.gguf"), "TCQ (2.25-bit)");
        assert_eq!(detect_quant_from_filename("qwen-TURBO2.gguf"), "TurboQuant 2-bit");
        assert_eq!(detect_quant_from_filename("qwen-TQ1.gguf"), "TurboQuant 2-bit");
        assert_eq!(detect_quant_from_filename("qwen-TURBO3.gguf"), "TurboQuant 3-bit");
        assert_eq!(detect_quant_from_filename("qwen-TURBO4.gguf"), "TurboQuant 4-bit");
        assert_eq!(detect_quant_from_filename("qwen-TQ2.gguf"), "TurboQuant 4-bit");
    }

    #[test]
    fn tcq_has_priority_over_other_turbo_marks() {
        // TCQ проверяется первым даже при наличии TURBO3 в имени
        assert_eq!(
            detect_quant_from_filename("TURBO3_TCQ_final.gguf"),
            "TCQ (2.25-bit)"
        );
    }

    #[test]
    fn detects_half_precision() {
        assert_eq!(detect_quant_from_filename("model-BF16.gguf"), "F16");
        assert_eq!(detect_quant_from_filename("model-f16.gguf"), "F16");
    }

    #[test]
    fn unknown_quant_defaults_to_gguf() {
        assert_eq!(detect_quant_from_filename("plain-model.gguf"), "GGUF");
        assert_eq!(detect_quant_from_filename(""), "GGUF");
        assert_eq!(detect_quant_from_filename("IQ2_XS.gguf"), "GGUF", "несписочный квант → default");
    }

    #[test]
    fn hf_model_card_parsing_shape() {
        // Проверяем, что DTO-структуры сериализуемы туда-обратно (используются фронтом)
        let card = HfModelCard {
            id: "author/model".into(),
            author: Some("author".into()),
            name: "model".into(),
            downloads: 10,
            likes: 2,
            tags: vec!["gguf".into()],
            gguf_files: vec![GgufFileInfo {
                filename: "m.Q4_K_M.gguf".into(),
                size_bytes: 123,
                size_gb: 0.1,
                quantization: detect_quant_from_filename("m.Q4_K_M.gguf"),
            }],
        };
        let json = serde_json::to_string(&card).expect("serialize");
        let back: HfModelCard = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.id, "author/model");
        assert_eq!(back.gguf_files[0].quantization, "Q4_K_M");
    }

    // ------------------------------------------------------------------
    // HTTP-ветка fetch_hf_models_inner через mock-сервер
    // ------------------------------------------------------------------

    type SharedBuf = std::sync::Arc<tokio::sync::Mutex<Vec<u8>>>;

    fn captured_str_impl(captured: &SharedBuf) -> String {
        String::from_utf8_lossy(&captured.try_lock().unwrap()).into_owned()
    }

    /// Mock-сервер: один JSON-ответ на все запросы, захват байтов запроса.
    async fn spawn_mock(body: &'static str, captured: SharedBuf) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            for _ in 0..8 {
                let mut s = match listener.accept().await {
                    Ok((s, _)) => s,
                    Err(_) => break,
                };
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let mut buf = vec![0u8; 32768];
                let mut total = 0;
                loop {
                    let n = match s.read(&mut buf[total..]).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => n,
                    };
                    total += n;
                    if buf[..total].windows(4).any(|w| w == b"\r\n\r\n") {
                        break;
                    }
                }
                if total > 0 {
                    captured.lock().await.extend_from_slice(&buf[..total]);
                }
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = s.write_all(resp.as_bytes()).await;
                drop(s);
            }
        });
        format!("http://127.0.0.1:{port}")
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn hf_catalog_parsed_gguf_only() {
        let captured: SharedBuf = Default::default();
        let base = spawn_mock(
            r#"[{
                "id": "author/nemotron-embed",
                "author": "author",
                "downloads": 1000,
                "likes": 50,
                "tags": ["gguf", "text-generation"],
                "siblings": [
                    {"rfilename": "model-Q4_K_M.gguf"},
                    {"rfilename": "model.Q8_0.gguf"},
                    {"rfilename": "README.md"},
                    {"rfilename": "config.json"}
                ]
            }]"#,
            captured.clone(),
        )
        .await;

        let cards = fetch_hf_models_inner(None, None, Some(&base))
            .await
            .expect("каталог должен распарситься");

        assert_eq!(cards.len(), 1);
        let card = &cards[0];
        assert_eq!(card.id, "author/nemotron-embed");
        assert_eq!(card.name, "nemotron-embed", "name = последний сегмент id");
        assert_eq!(card.downloads, 1000);
        assert_eq!(card.likes, 50);
        // только .gguf-файлы попадают в карточку
        assert_eq!(card.gguf_files.len(), 2, "{:?}", card.gguf_files);
        assert_eq!(card.gguf_files[0].quantization, "Q4_K_M");
        assert_eq!(card.gguf_files[1].quantization, "Q8_0");
        assert_eq!(card.gguf_files[0].size_bytes, 0);

        let req = captured_str_impl(&captured);
        assert!(
            req.to_ascii_lowercase().contains("user-agent: worldwiki/1.0"),
            "{req}"
        );
        assert!(
            req.contains("/api/models?filter=gguf&sort=downloads&direction=-1&limit=40&full=true"),
            "{req}"
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn hf_search_query_percent_encoded() {
        let captured: SharedBuf = Default::default();
        let base = spawn_mock("[]", captured.clone()).await;

        fetch_hf_models_inner(Some("qwen 2.5"), None, Some(&base))
            .await
            .unwrap();

        let req = captured_str_impl(&captured);
        assert!(
            req.contains("&search=qwen%202.5"),
            "пробел кодируется %20: {req}"
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn hf_bearer_token_sent_when_present() {
        let captured: SharedBuf = Default::default();
        let base = spawn_mock("[]", captured.clone()).await;

        fetch_hf_models_inner(None, Some("hf-token"), Some(&base))
            .await
            .unwrap();
        assert!(
            captured_str_impl(&captured)
                .to_ascii_lowercase()
                .contains("authorization: bearer hf-token"),
            "bearer из токена"
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn hf_blank_token_not_sent_and_network_error_surfaced() {
        // Пустой токен на живом моке — заголовка быть не должно
        let captured: SharedBuf = Default::default();
        let base = spawn_mock("[]", captured.clone()).await;
        fetch_hf_models_inner(None, Some("   "), Some(&base)).await.unwrap();
        assert!(
            !captured_str_impl(&captured).to_ascii_lowercase().contains("authorization:"),
            "пустой токен не отправляется"
        );

        // Недоступный хост → сетевая ошибка с человеческим текстом
        let err = fetch_hf_models_inner(None, None, Some("http://127.0.0.1:1"))
            .await
            .expect_err("недоступный хост → Err");
        assert!(err.contains("Ошибка подключения к Hugging Face"), "{err}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn hf_invalid_json_is_parse_err() {
        let captured: SharedBuf = Default::default();
        let base = spawn_mock("not-a-json-array{{", captured).await;

        let err = fetch_hf_models_inner(None, None, Some(&base))
            .await
            .expect_err("битый JSON → Err");
        assert!(err.contains("Ошибка парсинга ответа Hugging Face"), "{err}");
    }
}

/// Download a GGUF model file directly into local models directory with streaming progress
#[tauri::command]
pub async fn download_hf_model(
    app: AppHandle,
    repo_id: String,
    filename: String,
    token: Option<String>,
) -> Result<String, String> {
    let models_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("models");

    tokio::fs::create_dir_all(&models_dir)
        .await
        .map_err(|e| format!("Не удалось создать директорию моделей: {e}"))?;

    let dest_path = models_dir.join(&filename);
    let download_url = format!("https://huggingface.co/{repo_id}/resolve/main/{filename}");

    let client = Client::new();
    let mut req = client
        .get(&download_url)
        .header("User-Agent", "WorldWiki/1.0");

    if let Some(tok) = token {
        let t = tok.trim();
        if !t.is_empty() {
            req = req.header("Authorization", format!("Bearer {t}"));
        }
    }

    let mut resp = req
        .send()
        .await
        .map_err(|e| format!("Ошибка запроса на скачивание: {e}"))?;

    if resp.status().as_u16() == 401 {
        return Err("Ошибка 401 (Нет доступа): Модель требует авторизации через HF Token или файл не найден в репозитории.".to_string());
    } else if resp.status().as_u16() == 404 {
        return Err("Ошибка 404: Файл модели не найден на сервере Hugging Face.".to_string());
    } else if !resp.status().is_success() {
        return Err(format!("Загрузка завершилась со статусом: {}", resp.status()));
    }

    let total_bytes = resp.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create target file: {e}"))?;

    let mut downloaded_bytes = 0u64;
    let mut last_emitted_percent = 0.0f32;
    let mut last_emit_time = std::time::Instant::now();

    while let Some(chunk) = resp.chunk().await.map_err(|e| {
        let err_msg = format!("Chunk stream error: {e}");
        let _ = app.emit(
            "model_download_progress",
            DownloadProgressEvent {
                repo_id: repo_id.clone(),
                filename: filename.clone(),
                downloaded_bytes,
                total_bytes,
                percent: 0.0,
                is_done: false,
                error: Some(err_msg.clone()),
            },
        );
        err_msg
    })? {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("File write error: {e}"))?;

        downloaded_bytes += chunk.len() as u64;

        let percent = if total_bytes > 0 {
            (downloaded_bytes as f64 / total_bytes as f64 * 100.0) as f32
        } else {
            0.0
        };

        if percent - last_emitted_percent >= 0.2 || last_emit_time.elapsed().as_millis() >= 200 {
            last_emitted_percent = percent;
            last_emit_time = std::time::Instant::now();

            let _ = app.emit(
                "model_download_progress",
                DownloadProgressEvent {
                    repo_id: repo_id.clone(),
                    filename: filename.clone(),
                    downloaded_bytes,
                    total_bytes,
                    percent,
                    is_done: false,
                    error: None,
                },
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush error: {e}"))?;

    let _ = app.emit(
        "model_download_progress",
        DownloadProgressEvent {
            repo_id,
            filename: filename.clone(),
            downloaded_bytes,
            total_bytes,
            percent: 100.0,
            is_done: true,
            error: None,
        },
    );

    Ok(dest_path.to_string_lossy().to_string())
}
