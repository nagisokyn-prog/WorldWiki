//! Permissions and tools directory with rich Russian metadata, categories, and risk levels.

use super::types::{PermissionLevel, RiskLevel, ToolCategory, ToolPermissionConfig};

/// Returns complete catalog of tools and their permission configs in 100% Russian
#[tauri::command]
pub fn get_tool_permissions_catalog() -> Vec<ToolPermissionConfig> {
    vec![
        // ЧТЕНИЕ (READ)
        ToolPermissionConfig {
            id: "rag_search".to_string(),
            name: "Семантический поиск (Auto-RAG)".to_string(),
            description: "Поиск фактов по энциклопедии, тексту глав, персонажам и календарю".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "search_entities".to_string(),
            name: "Поиск сущностей".to_string(),
            description: "Поиск персонажей, локаций, фракций по именам и ключевым тегам".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "get_entity".to_string(),
            name: "Чтение карточки сущности".to_string(),
            description: "Получение полного описания, черт и истории конкретной сущности".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "get_relations".to_string(),
            name: "Чтение связей".to_string(),
            description: "Просмотр отношений (дружба, вражда, родство) между сущностями".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "get_chapters".to_string(),
            name: "Список глав книги".to_string(),
            description: "Просмотр оглавления, структуры томов и арок книги".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "get_chapter_content".to_string(),
            name: "Чтение текста главы".to_string(),
            description: "Загрузка полного текста выбранной главы книги".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "get_calendar_events".to_string(),
            name: "Чтение календаря и событий".to_string(),
            description: "Просмотр хронологии и дат важных исторических событий мира".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "get_graph_neighborhood".to_string(),
            name: "Окрестности графа связей".to_string(),
            description: "Исследование соседних узлов графа на глубину до 2-3 шагов".to_string(),
            category: ToolCategory::Read,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },

        // АНАЛИТИКА (ANALYTICS)
        ToolPermissionConfig {
            id: "detect_plot_holes".to_string(),
            name: "Поиск сюжетных дыр".to_string(),
            description: "Анализ текста глав на наличие сюжетных нестыковок и хронологических ошибок".to_string(),
            category: ToolCategory::Analytics,
            risk: RiskLevel::Medium,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "check_character_consistency".to_string(),
            name: "Проверка согласованности персонажа".to_string(),
            description: "Проверка реплик и действий героя на соответствие его характеру и лору".to_string(),
            category: ToolCategory::Analytics,
            risk: RiskLevel::Medium,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "generate_timeline".to_string(),
            name: "Построение таймлайна".to_string(),
            description: "Сведение разрозненных дат и глав в единую временную шкалу".to_string(),
            category: ToolCategory::Analytics,
            risk: RiskLevel::Low,
            default_level: PermissionLevel::Allow,
            user_level: None,
        },

        // РЕДАКТИРОВАНИЕ (EDIT)
        ToolPermissionConfig {
            id: "create_entity".to_string(),
            name: "Создание новой сущности".to_string(),
            description: "Добавление нового персонажа, локации или предмета в энциклопедию мира".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "update_entity".to_string(),
            name: "Изменение карточки сущности".to_string(),
            description: "Редактирование полей, биографии или параметров существующей сущности".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "delete_entity".to_string(),
            name: "Удаление сущности".to_string(),
            description: "Безвозвратное удаление сущности и всех связанных с ней данных".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "create_relation".to_string(),
            name: "Создание связи".to_string(),
            description: "Установка новых отношений между двумя сущностями".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "delete_relation".to_string(),
            name: "Удаление связи".to_string(),
            description: "Удаление связи между персонажами или локациями".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "create_chapter".to_string(),
            name: "Создание новой главы".to_string(),
            description: "Добавление новой главы в структуру книги".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "update_chapter".to_string(),
            name: "Изменение текста главы".to_string(),
            description: "Перезапись или дополнение содержимого главы книги".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },
        ToolPermissionConfig {
            id: "create_calendar_event".to_string(),
            name: "Создание события в календаре".to_string(),
            description: "Добавление даты и описания события на временную шкалу".to_string(),
            category: ToolCategory::Edit,
            risk: RiskLevel::High,
            default_level: PermissionLevel::Ask,
            user_level: None,
        },

        // СИСТЕМНЫЕ (SYSTEM)
        ToolPermissionConfig {
            id: "execute_command".to_string(),
            name: "Выполнение команд в системе".to_string(),
            description: "Запуск системных процессов и скриптов на компьютере".to_string(),
            category: ToolCategory::System,
            risk: RiskLevel::Critical,
            default_level: PermissionLevel::Deny,
            user_level: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn catalog_is_not_empty() {
        let catalog = get_tool_permissions_catalog();
        assert!(catalog.len() >= 10, "каталог должен содержать все инструменты");
    }

    #[test]
    fn catalog_ids_are_unique() {
        let catalog = get_tool_permissions_catalog();
        let ids: HashSet<&str> = catalog.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(ids.len(), catalog.len(), "дубликаты id инструментов недопустимы");
    }

    #[test]
    fn every_entry_has_metadata() {
        for t in get_tool_permissions_catalog() {
            assert!(!t.id.is_empty());
            assert!(!t.name.is_empty(), "{}: имя пустое", t.id);
            assert!(!t.description.is_empty(), "{}: описание пустое", t.id);
        }
    }

    #[test]
    fn read_tools_are_low_risk_allow_by_default() {
        for t in get_tool_permissions_catalog() {
            if matches!(t.category, ToolCategory::Read) {
                assert!(
                    matches!(t.risk, RiskLevel::Low),
                    "{}: читающий инструмент должен быть Low risk",
                    t.id
                );
                assert!(
                    matches!(t.default_level, PermissionLevel::Allow),
                    "{}: читающий инструмент должен быть Allow по умолчанию",
                    t.id
                );
            }
        }
    }

    #[test]
    fn edit_tools_ask_by_default_and_system_denied() {
        for t in get_tool_permissions_catalog() {
            match t.category {
                ToolCategory::Edit => {
                    assert!(
                        matches!(t.default_level, PermissionLevel::Ask),
                        "{}: редактирование должно требовать подтверждения",
                        t.id
                    );
                }
                ToolCategory::System => {
                    assert!(
                        matches!(t.default_level, PermissionLevel::Deny),
                        "{}: системные команды должны быть запрещены по умолчанию",
                        t.id
                    );
                    assert!(matches!(t.risk, RiskLevel::Critical | RiskLevel::High));
                }
                _ => {}
            }
        }
    }

    #[test]
    fn user_level_is_none_for_defaults() {
        // Каталог — это дефолты; пользовательские переопределения приходят отдельно
        for t in get_tool_permissions_catalog() {
            assert!(t.user_level.is_none(), "{}: user_level должен быть None", t.id);
        }
    }

    #[test]
    fn key_rag_tools_present_in_catalog() {
        let catalog = get_tool_permissions_catalog();
        let ids: HashSet<&str> = catalog.iter().map(|t| t.id.as_str()).collect();
        for expected in ["rag_search", "search_entities", "get_entity", "get_relations",
                         "create_entity", "update_entity", "delete_entity", "update_chapter"] {
            assert!(ids.contains(expected), "в каталоге отсутствует инструмент {expected}");
        }
    }
}
