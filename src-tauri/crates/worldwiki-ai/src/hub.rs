use reqwest::Client;
use serde::Deserialize;
use worldwiki_domain::ai::types::{GgufFileInfo, HfModelCard};
use worldwiki_domain::errors::DomainError;

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

pub fn detect_quant_from_filename(filename: &str) -> String {
    const PATTERNS: &[(&str, &str)] = &[
        ("TURBO3_TCQ", "TCQ (2.25-bit)"),
        ("TCQ", "TCQ (2.25-bit)"),
        ("TURBO2", "TurboQuant 2-bit"),
        ("TQ1", "TurboQuant 2-bit"),
        ("TURBO3", "TurboQuant 3-bit"),
        ("TURBO4", "TurboQuant 4-bit"),
        ("TQ2", "TurboQuant 4-bit"),
        ("Q4_K_M", "Q4_K_M"),
        ("Q4_K_S", "Q4_K_S"),
        ("Q5_K_M", "Q5_K_M"),
        ("Q8_0", "Q8_0"),
        ("BF16", "F16"),
        ("F16", "F16"),
    ];
    let upper = filename.to_uppercase();
    PATTERNS
        .iter()
        .find(|(pat, _)| upper.contains(pat))
        .map(|(_, label)| (*label).to_string())
        .unwrap_or_else(|| "GGUF".to_string())
}

pub async fn fetch_hf_models_inner(
    query: Option<&str>,
    token: Option<&str>,
    base_override: Option<&str>,
) -> Result<Vec<HfModelCard>, DomainError> {
    let search_part = if let Some(q) = query {
        if !q.trim().is_empty() {
            let encoded: String = q
                .trim()
                .chars()
                .map(|c| {
                    if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                        c.to_string()
                    } else {
                        format!("%{:02X}", c as u32)
                    }
                })
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
    let mut req = client.get(&url).header("User-Agent", "WorldWiki/1.0");

    if let Some(tok) = token {
        let t = tok.trim();
        if !t.is_empty() {
            req = req.header("Authorization", format!("Bearer {t}"));
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Ошибка подключения к Hugging Face: {e}")))?;
    if !resp.status().is_success() {
        return Err(DomainError::Validation(format!("Hugging Face вернул ошибку: {}", resp.status())));
    }

    let items: Vec<HfApiResponseItem> = resp
        .json()
        .await
        .map_err(|e| DomainError::Validation(format!("Ошибка парсинга ответа Hugging Face: {e}")))?;

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

        let name = item
            .id
            .split('/')
            .next_back()
            .unwrap_or(&item.id)
            .to_string();
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

#[cfg(test)]
#[path = "hub_tests.rs"]
mod tests;
