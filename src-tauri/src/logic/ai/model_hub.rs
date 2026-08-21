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
pub async fn fetch_hf_models(query: Option<String>) -> Result<Vec<HfModelCard>, String> {
    let search_part = if let Some(ref q) = query {
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

    let url = format!("https://huggingface.co/api/models?filter=gguf&sort=downloads&direction=-1&limit=40&full=true{search_part}");

    let client = Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "WorldWiki/1.0")
        .send()
        .await
        .map_err(|e| format!("HF request error: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HF API returned error: {}", resp.status()));
    }

    let items: Vec<HfApiResponseItem> = resp.json().await.map_err(|e| format!("HF JSON parse error: {e}"))?;

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

/// Download a GGUF model file directly into local models directory with streaming progress
#[tauri::command]
pub async fn download_hf_model(
    app: AppHandle,
    repo_id: String,
    filename: String,
) -> Result<String, String> {
    let models_dir = app
        .path()
        .app_data_dir()
        .unwrap_or(PathBuf::from("."))
        .join("models");

    tokio::fs::create_dir_all(&models_dir)
        .await
        .map_err(|e| format!("Failed to create models directory: {e}"))?;

    let dest_path = models_dir.join(&filename);
    let download_url = format!("https://huggingface.co/{repo_id}/resolve/main/{filename}");

    let client = Client::new();
    let mut resp = client
        .get(&download_url)
        .header("User-Agent", "WorldWiki/1.0")
        .send()
        .await
        .map_err(|e| format!("Download request error: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }

    let total_bytes = resp.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create target file: {e}"))?;

    let mut downloaded_bytes = 0u64;

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
