use reqwest::Client;
use serde::Deserialize;
use worldwiki_domain::ai::types::{GgufFileInfo, HfModelCard};

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
        .map_err(|e| format!("Ошибка подключения к Hugging Face: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Hugging Face вернул ошибку: {}", resp.status()));
    }

    let items: Vec<HfApiResponseItem> = resp
        .json()
        .await
        .map_err(|e| format!("Ошибка парсинга ответа Hugging Face: {e}"))?;

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
        assert_eq!(
            detect_quant_from_filename("QwEn-Q8_0-Instruct.gguf"),
            "Q8_0"
        );
    }

    #[test]
    fn detects_turboquant_family() {
        assert_eq!(
            detect_quant_from_filename("nemotron-TURBO3_TCQ.gguf"),
            "TCQ (2.25-bit)"
        );
        assert_eq!(detect_quant_from_filename("x_TCQ_y.gguf"), "TCQ (2.25-bit)");
        assert_eq!(
            detect_quant_from_filename("qwen-TURBO2.gguf"),
            "TurboQuant 2-bit"
        );
        assert_eq!(
            detect_quant_from_filename("qwen-TQ1.gguf"),
            "TurboQuant 2-bit"
        );
        assert_eq!(
            detect_quant_from_filename("qwen-TURBO3.gguf"),
            "TurboQuant 3-bit"
        );
        assert_eq!(
            detect_quant_from_filename("qwen-TURBO4.gguf"),
            "TurboQuant 4-bit"
        );
        assert_eq!(
            detect_quant_from_filename("qwen-TQ2.gguf"),
            "TurboQuant 4-bit"
        );
    }

    #[test]
    fn tcq_has_priority_over_other_turbo_marks() {
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
        assert_eq!(detect_quant_from_filename("IQ2_XS.gguf"), "GGUF");
    }
}
