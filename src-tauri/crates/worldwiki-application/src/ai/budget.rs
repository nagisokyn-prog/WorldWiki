use worldwiki_domain::ai::{ContextBundle, ContextItem};

pub struct ContextBudgetManager {
    budget_limit: usize,
}

impl ContextBudgetManager {
    pub fn new(budget_limit: usize) -> Self {
        Self { budget_limit }
    }

    /// Простая грубая оценка токенов: ~4 символа на токен (для рус/англ текста ~2-3 симв.)
    pub fn estimate_tokens(text: &str) -> usize {
        let chars = text.chars().count();
        if chars == 0 {
            0
        } else {
            (chars / 3).max(1)
        }
    }

    /// Сборка элементов контекста в рамках лимита с учетом жестких приоритетов:
    /// Приоритет 1 (Гарантированный): Системный промпт, вопрос пользователя, явная ссылка (цитата).
    /// Приоритет 2: Скилл-инструкция, ближайшие реплики ветки (±1..2), найденные Web Evidence.
    /// Приоритет 3: Дальние реплики диалога (±3..5).
    /// Приоритет 4: Ассоциативная память (Cross-chat memory) и архив.
    pub fn allocate(&self, mut raw_items: Vec<ContextItem>) -> ContextBundle {
        // Сортируем по приоритету (1 выше, чем 4)
        raw_items.sort_by_key(|item| item.priority);

        let mut bundle = ContextBundle::new(self.budget_limit);
        let mut used_tokens = 0;

        for item in raw_items {
            if used_tokens + item.tokens <= self.budget_limit {
                used_tokens += item.tokens;
                bundle.add_item(item);
            } else if item.priority == 1 {
                // Приоритет 1 включается всегда (даже если превышен базовый бюджет)
                used_tokens += item.tokens;
                bundle.add_item(item);
            } else if item.priority <= 4 && self.budget_limit > used_tokens {
                // Пытаемся частично сжать (урезать) текст элемента
                let available_tokens = self.budget_limit - used_tokens;
                if available_tokens >= 30 {
                    let available_chars = available_tokens * 3;
                    let truncated_content = if item.content.chars().count() > available_chars {
                        let shortened: String =
                            item.content.chars().take(available_chars).collect();
                        format!("{}… [обрезано по лимиту контекста]", shortened.trim_end())
                    } else {
                        item.content.clone()
                    };

                    let est = Self::estimate_tokens(&truncated_content);
                    used_tokens += est;
                    bundle.add_item(ContextItem {
                        source: item.source,
                        source_id: item.source_id,
                        tokens: est,
                        priority: item.priority,
                        content: truncated_content,
                    });
                }
            }
        }

        bundle
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use worldwiki_domain::ai::ContextSource;

    #[test]
    fn test_context_budget_priorities() {
        let manager = ContextBudgetManager::new(500);

        let item_p1 = ContextItem {
            source: ContextSource::ExplicitReference,
            source_id: Some("msg_1".to_string()),
            tokens: 150,
            priority: 1,
            content: "Critical reference text".to_string(),
        };

        let item_p2 = ContextItem {
            source: ContextSource::WebEvidence,
            source_id: Some("ev_1".to_string()),
            tokens: 200,
            priority: 2,
            content: "Important web evidence text".to_string(),
        };

        let item_p4 = ContextItem {
            source: ContextSource::CrossChatMemory,
            source_id: Some("mem_1".to_string()),
            tokens: 300,
            priority: 4,
            content: "Old chat memory text".to_string(),
        };

        let bundle = manager.allocate(vec![item_p4, item_p1, item_p2]);
        assert_eq!(bundle.items.len(), 3); // p1 (150) + p2 (200) + p4 (truncated to 150)
        assert!(bundle.total_tokens <= 500);
    }
}
