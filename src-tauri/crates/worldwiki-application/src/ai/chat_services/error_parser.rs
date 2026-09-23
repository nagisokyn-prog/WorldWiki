//! Human-friendly error parsing for various LLM provider error formats and HTTP status codes.

use serde_json::Value;

pub fn parse_llm_error_to_human(raw_err: &str) -> String {
    let mut extracted_msg: Option<String> = None;
    let mut extracted_remedy: Option<String> = None;

    if let Some(json_start) = raw_err.find('{') {
        if let Some(sub) = raw_err.get(json_start..) {
            if let Ok(val) = serde_json::from_str::<Value>(sub) {
                if let Some(err_obj) = val.get("error") {
                    if let Some(msg) = err_obj.get("message").and_then(|m| m.as_str()) {
                        extracted_msg = Some(msg.to_string());
                    }
                    if let Some(meta) = err_obj.get("metadata") {
                        if let Some(remedy) = meta.get("remedy_hint").and_then(|r| r.as_str()) {
                            extracted_remedy = Some(remedy.to_string());
                        }
                    }
                } else if let Some(msg) = val.get("message").and_then(|m| m.as_str()) {
                    extracted_msg = Some(msg.to_string());
                }
            }
        }
    }

    let detail_msg = extracted_msg.unwrap_or_else(|| {
        let clean = raw_err
            .trim_start_matches("Constraint violation: ")
            .trim_start_matches("Execution failed: ");
        clean.to_string()
    });

    let lower = raw_err.to_lowercase();
    if lower.contains("429") || lower.contains("rate limit") {
        let remedy_hint = extracted_remedy
            .map(|r| format!("\n\n> *Подсказка провайдера*: {r}"))
            .unwrap_or_default();
        format!(
            "🚫 **Превышен лимит запросов (Rate Limit / 429)**\n\n> **Причина**: {detail_msg}{remedy_hint}\n\n💡 **Решение**: Переключитесь на другую модель или провайдера в **Настройках ИИ** (шестерёнка в верхнем правом углу), либо пополните баланс."
        )
    } else if lower.contains("401") || lower.contains("invalid api key") || lower.contains("unauthorized") {
        format!(
            "🔑 **Ошибка авторизации (401 Unauthorized)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Проверьте и обновите ваш API-ключ в **Настройках ИИ** (шестерёнка в верхнем правом углу)."
        )
    } else if lower.contains("402") || lower.contains("payment required") || lower.contains("insufficient balance") {
        format!(
            "💳 **Недостаточно средств (402 Payment Required)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Пополните баланс на стороне выбранного провайдера или выберите бесплатную модель."
        )
    } else if lower.contains("404") || lower.contains("model not found") || lower.contains("does not exist") {
        format!(
            "🔍 **Модель не найдена (404 Not Found)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Выберите актуальную модель из выпадающего списка в **Настройках ИИ**."
        )
    } else if lower.contains("500") || lower.contains("502") || lower.contains("503") || lower.contains("504") || lower.contains("bad gateway") || lower.contains("server error") {
        format!(
            "🌐 **Сбой сервера провайдера (5xx Server Error)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Сервер провайдера временно перегружен или недоступен. Попробуйте повторить запрос через минуту или сменить провайдера."
        )
    } else {
        format!(
            "⚠️ **Сбой обращения к ИИ**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Проверьте настройки модели и интернет-соединение."
        )
    }
}
