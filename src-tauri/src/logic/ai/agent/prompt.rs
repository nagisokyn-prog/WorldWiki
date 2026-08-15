use serde_json::Value;
use claw_api::{InputMessage, InputContentBlock};

/// Стоп-критерии и лимиты (контекстное окно).
pub const MAX_AGENT_ITERATIONS: usize = 8;
pub const DEFAULT_MAX_TOKENS: u32 = 4096;
/// Бюджет на историю, отдаваемую модели (приблизительно, в символах).
pub const HISTORY_CHAR_BUDGET: usize = 120_000;


/// Системный промпт: агент-соавтор, отвечает только по данным из БД (RAG).
pub fn build_system_prompt(
    role_definition: &str,
    custom_instructions: &str,
    project_id: &str,
) -> String {
    let global_core = "====\nГЛОБАЛЬНЫЕ ПРАВИЛА СОАВТОРА WORLDWIKI\n\nТы — литературный соавтор, а не просто ИИ или программист. Твоя цель — помогать писателю создавать живой мир и текст.\n\n\
        1. ПРАВИЛА ОБЩЕНИЯ И ФОРМАТИРОВАНИЯ:\n   \
        - Общайся на языке пользователя (по умолчанию русский).\n   \
        - НИКОГДА не упоминай технические названия инструментов (например, rag_search, get_entity), базы данных, ID сущностей или JSON. Пользователю плевать на техническую изнанку. Говори литературно: \"Я просмотрел твои записи о магии...\", \"В архивах указано...\".\n   \
        - Если поиск ничего не дал — скажи об этом честно, не выдумывай лор.\n\n\
        2. ЛИТЕРАТУРНАЯ ТЕОРИЯ (ОБЪЕКТИВНЫЙ КОРРЕЛЯТ):\n   \
        Следуй принципу Т.С. Элиота: эмоции выражаются через объекты и ситуации, а не прямое называние.\n   \
        - ЗАПРЕЩЕНО: Описывать эмоции \"в лоб\" (например, \"он разозлился\", \"ей было грустно\").\n   \
        - РЕКОМЕНДУЕТСЯ: Создавать сцены через внешние детали (предметы, звуки, свет, запахи, ритм движений). Если автор просит \"усилить сцену\", предложи изменить окружение и действия, а не просто добавляй эмоциональные прилагательные.\n\n\
        3. КОНТЕКСТ ПРОИЗВЕДЕНИЯ:\n   \
        - Ты работаешь с текстом в процессе написания.\n   \
        - Учитывай хронологию: не критикуй героев или мир за \"недораскрытость\" в первой главе. Тайна в начале истории — это норма.\n   \
        - Анализируй только то, что просят.\n\n\
        ====\nРАБОТА С ИНСТРУМЕНТАМИ\n\n\
        АНАЛИЗ НАМЕРЕНИЯ (ОБЯЗАТЕЛЬНЫЙ ШАГ):\n\
        Перед любым действием ты ДОЛЖЕН выполнить этот мысленный алгоритм:\n\
        1. ОПРЕДЕЛИ НАМЕРЕНИЕ: Пользователь просто общается (приветствует, шутит, размышляет) или делает запрос фактов/анализа лора?\n   \
        - Если разговор: НЕ ИСПОЛЬЗУЙ ИНСТРУМЕНТЫ. Отвечай как собеседник.\n   \
        - Если нужен лор: ПЕРЕЙДИ К ШАГУ 2.\n\n\
        ПОРЯДОК ИСПОЛЬЗОВАНИЯ ИНСТРУМЕНТОВ:\n\
        1. НИКОГДА не угадывай ID сущности.\n\
        2. Всегда сначала используй rag_search или search_entities для поиска по тексту.\n\
        3. Только получив реальный ID из результатов поиска, используй точечные методы (get_entity, get_chapter и т.д.).\n\
        4. Если режим запрещает изменения (update_entity, create_entity), не пытайся их использовать.";

    let base = if role_definition.trim().is_empty() {
        "Ты — соавтор и редактор писательской вселенной в приложении WorldWiki."
    } else {
        role_definition
    };

    let mut out = format!(
        "{}\n\n{}\n\nПроект: {}\nДоступные данные: entities, chapters, text_blocks, volumes, arcs, entity_rel, calendars, user_dictionary.\nТаймлайн хранится в chapters.timeline_events.",
        base, global_core, project_id
    );

    if !custom_instructions.trim().is_empty() {
        out.push_str("\n\n====\nДополнительные указания пользователя:\n");
        out.push_str(custom_instructions.trim());
    }
    out
}

pub fn history_to_input_messages(history: &[Value], assistant_msg_id: &str) -> Vec<InputMessage> {
    use std::collections::HashMap;

    let mut map: HashMap<String, &Value> = HashMap::new();
    for msg in history {
        if let Some(id) = msg.get("id").and_then(|v| v.as_str()) {
            map.insert(id.to_string(), msg);
        }
    }

    let mut chain = Vec::new();
    let mut current_id = Some(assistant_msg_id.to_string());

    while let Some(id) = current_id {
        if let Some(msg) = map.get(&id) {
            chain.push(*msg); // Newest first

            if let Some(parent) = msg.get("parent_id") {
                if parent.is_null() {
                    current_id = None;
                } else if let Some(parent_id) = parent.as_str() {
                    if parent_id == "NONE" || parent_id.is_empty() {
                        current_id = None;
                    } else {
                        current_id = Some(parent_id.to_string());
                    }
                } else {
                    current_id = None;
                }
            } else {
                current_id = None;
            }
        } else {
            break;
        }
    }

    let mut total = 0usize;
    let mut out = Vec::new();

    // Process from newest to oldest to keep latest messages within budget
    for msg in chain {
        let role = msg.get("role").and_then(|v| v.as_str()).unwrap_or("user");
        let content = msg.get("content").and_then(|v| v.as_str()).unwrap_or("");

        let is_active = msg
            .get("is_active")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        if !is_active {
            continue;
        }

        if role == "assistant" && content.is_empty() {
            continue;
        }

        if total + content.len() > HISTORY_CHAR_BUDGET {
            break;
        }

        total += content.len();
        if role == "assistant" {
            out.push(InputMessage {
                role: "assistant".to_string(),
                content: vec![InputContentBlock::Text {
                    text: content.to_string(),
                }],
            });
        } else {
            out.push(InputMessage::user_text(content.to_string()));
        }
    }

    // Restore chronological order
    out.reverse();
    out
}
