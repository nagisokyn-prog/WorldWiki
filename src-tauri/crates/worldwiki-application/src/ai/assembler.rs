use worldwiki_domain::ai::{
    ContextBundle, ContextItem, ContextSource, MessageNeighborhood,
    WebEvidence,
};
use super::budget::ContextBudgetManager;

pub struct ContextAssembler {
    budget_manager: ContextBudgetManager,
}

impl ContextAssembler {
    pub fn new(budget_limit: usize) -> Self {
        Self {
            budget_manager: ContextBudgetManager::new(budget_limit),
        }
    }

    /// Сборка полного контекстного бандла с расчетом provenance и токенов
    pub fn assemble(
        &self,
        system_prompt: &str,
        skill_instruction: Option<&str>,
        quoted_selection: Option<&str>,
        neighborhood: Option<&MessageNeighborhood>,
        web_evidences: &[WebEvidence],
        cross_chat_memories: &[String],
    ) -> ContextBundle {
        let mut items = Vec::new();

        // 1. Системный промпт (Приоритет 1 - гарантированный)
        items.push(ContextItem {
            source: ContextSource::ConversationLineage,
            source_id: Some("system_prompt".to_string()),
            tokens: ContextBudgetManager::estimate_tokens(system_prompt),
            priority: 1,
            content: system_prompt.to_string(),
        });

        // 2. Явный выделенный фрагмент (Ask WoWiLon reference - Приоритет 1)
        if let Some(selection) = quoted_selection {
            if !selection.trim().is_empty() {
                let text = format!("\n[ЦИТИРУЕМЫЙ ФРАГМЕНТ ИЗ ПРЕДЫДУЩЕГО СООБЩЕНИЯ]:\n«{}»\n", selection);
                items.push(ContextItem {
                    source: ContextSource::ExplicitReference,
                    source_id: Some("user_selection".to_string()),
                    tokens: ContextBudgetManager::estimate_tokens(&text),
                    priority: 1,
                    content: text,
                });
            }
        }

        // 3. Скилл-инструкция (Приоритет 2)
        if let Some(skill) = skill_instruction {
            if !skill.trim().is_empty() {
                let text = format!("\n[АКТИВНЫЙ НАВЫК ПИСАТЕЛЯ]:\n{}\n", skill);
                items.push(ContextItem {
                    source: ContextSource::ToolResult,
                    source_id: Some("active_skill".to_string()),
                    tokens: ContextBudgetManager::estimate_tokens(&text),
                    priority: 2,
                    content: text,
                });
            }
        }

        // 4. Окрестность диалога по дереву Lineage (Приоритет 2 для ±1..2, Приоритет 3 для остальных)
        if let Some(neigh) = neighborhood {
            // Предки (хронологический порядок)
            for (i, msg) in neigh.before.iter().enumerate() {
                let distance = neigh.before.len() - i;
                let priority = if distance <= 2 { 2 } else { 3 };
                let prefix = match msg.role {
                    worldwiki_domain::ai::MessageRole::User => "Автор",
                    worldwiki_domain::ai::MessageRole::Assistant => "WoWiLon",
                    worldwiki_domain::ai::MessageRole::System => "Система",
                };
                let text = format!("{}: {}", prefix, msg.content);
                items.push(ContextItem {
                    source: ContextSource::ConversationLineage,
                    source_id: Some(msg.id.clone()),
                    tokens: ContextBudgetManager::estimate_tokens(&text),
                    priority,
                    content: text,
                });
            }

            // Целевое сообщение (Приоритет 1)
            let prefix = match neigh.target.role {
                worldwiki_domain::ai::MessageRole::User => "Автор",
                worldwiki_domain::ai::MessageRole::Assistant => "WoWiLon",
                worldwiki_domain::ai::MessageRole::System => "Система",
            };
            let text = format!("{}: {}", prefix, neigh.target.content);
            items.push(ContextItem {
                source: ContextSource::ConversationLineage,
                source_id: Some(neigh.target.id.clone()),
                tokens: ContextBudgetManager::estimate_tokens(&text),
                priority: 1,
                content: text,
            });

            // Потомки
            for msg in &neigh.after {
                let prefix = match msg.role {
                    worldwiki_domain::ai::MessageRole::User => "Автор",
                    worldwiki_domain::ai::MessageRole::Assistant => "WoWiLon",
                    worldwiki_domain::ai::MessageRole::System => "Система",
                };
                let text = format!("{}: {}", prefix, msg.content);
                items.push(ContextItem {
                    source: ContextSource::ConversationLineage,
                    source_id: Some(msg.id.clone()),
                    tokens: ContextBudgetManager::estimate_tokens(&text),
                    priority: 2,
                    content: text,
                });
            }
        }

        // 5. Найденные Web Evidence (Приоритет 2)
        for (idx, ev) in web_evidences.iter().enumerate() {
            let text = format!("\n[ИСТОЧНИК #{}: {}]:\n{}\n", idx + 1, ev.page_id, ev.text);
            items.push(ContextItem {
                source: ContextSource::WebEvidence,
                source_id: ev.id.clone(),
                tokens: ContextBudgetManager::estimate_tokens(&text),
                priority: 2,
                content: text,
            });
        }

        // 6. Cross-chat memories (Приоритет 4 - сжимаемые)
        for (idx, mem) in cross_chat_memories.iter().enumerate() {
            let text = format!("\n[ПАМЯТЬ ДРУГИХ ЧАТОВ]:\n{}\n", mem);
            items.push(ContextItem {
                source: ContextSource::CrossChatMemory,
                source_id: Some(format!("mem_{}", idx + 1)),
                tokens: ContextBudgetManager::estimate_tokens(&text),
                priority: 4,
                content: text,
            });
        }

        self.budget_manager.allocate(items)
    }
}
