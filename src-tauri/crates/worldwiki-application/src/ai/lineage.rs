use std::collections::HashMap;
use worldwiki_domain::ai::{ChatMessage, MessageNeighborhood};

/// Построение окрестности сообщения по дереву диалога (Lineage Traversal)
pub fn resolve_neighborhood(
    messages: &[ChatMessage],
    target_msg_id: &str,
    depth_before: usize,
    depth_after: usize,
) -> Option<MessageNeighborhood> {
    let clean_target = target_msg_id
        .trim_start_matches("chat_messages:")
        .trim_matches('`')
        .trim_matches('⟨')
        .trim_matches('⟩');

    // Индексируем сообщения по очищенному ID
    let mut by_id = HashMap::new();
    let mut by_parent = HashMap::new();
    let mut target_msg = None;

    for m in messages {
        let m_clean = m
            .id
            .trim_start_matches("chat_messages:")
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩');

        by_id.insert(m_clean.to_string(), m.clone());

        if let Some(ref p) = m.parent_id {
            let p_clean = p
                .trim_start_matches("chat_messages:")
                .trim_matches('`')
                .trim_matches('⟨')
                .trim_matches('⟩');
            by_parent
                .entry(p_clean.to_string())
                .or_insert_with(Vec::new)
                .push(m_clean.to_string());
        }

        if m_clean == clean_target {
            target_msg = Some(m.clone());
        }
    }

    let target = target_msg?;

    // 1. Обход предков (Ancestors) по цепочке parent_id к корню
    let mut before = Vec::new();
    let mut curr_parent = target.parent_id.as_ref().map(|p| {
        p.trim_start_matches("chat_messages:")
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .to_string()
    });

    while let Some(parent_id) = curr_parent {
        if before.len() >= depth_before {
            break;
        }
        if let Some(parent_msg) = by_id.get(&parent_id) {
            before.push(parent_msg.clone());
            curr_parent = parent_msg.parent_id.as_ref().map(|p| {
                p.trim_start_matches("chat_messages:")
                    .trim_matches('`')
                    .trim_matches('⟨')
                    .trim_matches('⟩')
                    .to_string()
            });
        } else {
            break;
        }
    }

    // Разворачиваем предков, чтобы они шли в естественном хронологическом порядке (корень -> target)
    before.reverse();

    // 2. Обход потомков (Descendants) по активной ветке
    let mut after = Vec::new();
    let mut curr_child = clean_target.to_string();

    while after.len() < depth_after {
        if let Some(children) = by_parent.get(&curr_child) {
            // Берем активного ребенка (по умолчанию последнего созданного)
            if let Some(next_id) = children.last() {
                if let Some(child_msg) = by_id.get(next_id) {
                    after.push(child_msg.clone());
                    curr_child = next_id.clone();
                } else {
                    break;
                }
            } else {
                break;
            }
        } else {
            break;
        }
    }

    Some(MessageNeighborhood {
        target,
        before,
        after,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use worldwiki_domain::ai::MessageRole;

    #[test]
    fn test_lineage_traversal_linear() {
        let msg1 = ChatMessage::new("msg_1", "p1", "c1", MessageRole::User, "Hello");
        let mut msg2 = ChatMessage::new("msg_2", "p1", "c1", MessageRole::Assistant, "Hi there");
        msg2.parent_id = Some("msg_1".to_string());
        let mut msg3 = ChatMessage::new("msg_3", "p1", "c1", MessageRole::User, "How are you?");
        msg3.parent_id = Some("msg_2".to_string());

        let messages = vec![msg1, msg2, msg3];
        let neighborhood = resolve_neighborhood(&messages, "msg_2", 5, 5).unwrap();

        assert_eq!(neighborhood.target.id, "msg_2");
        assert_eq!(neighborhood.before.len(), 1);
        assert_eq!(neighborhood.before[0].id, "msg_1");
        assert_eq!(neighborhood.after.len(), 1);
        assert_eq!(neighborhood.after[0].id, "msg_3");
    }
}
