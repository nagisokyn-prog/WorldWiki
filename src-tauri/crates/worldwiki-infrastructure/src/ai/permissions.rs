use worldwiki_domain::ai::{
    PermissionLevel, RiskLevel, ToolCategory, ToolPermissionConfig,
};
use worldwiki_ports::ai::PermissionsPort;

#[derive(Default, Clone)]
pub struct StaticPermissionsCatalog;

impl StaticPermissionsCatalog {
    pub fn new() -> Self {
        Self
    }
}

impl PermissionsPort for StaticPermissionsCatalog {
    fn get_tool_permissions_catalog(&self) -> Vec<ToolPermissionConfig> {
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
                id: "get_chapters_list".to_string(),
                name: "Оглавление книги".to_string(),
                description: "Просмотр дерева томов, арок и глав текущего произведения".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            ToolPermissionConfig {
                id: "get_chapter".to_string(),
                name: "Чтение текста главы".to_string(),
                description: "Чтение содержимого конкретной главы для проверки контекста".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // РЕДАКТИРОВАНИЕ (EDIT)
            ToolPermissionConfig {
                id: "create_entity".to_string(),
                name: "Создание сущности".to_string(),
                description: "Добавление нового персонажа, предмета или места в энциклопедию".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::Medium,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
            ToolPermissionConfig {
                id: "update_entity".to_string(),
                name: "Обновление сущности".to_string(),
                description: "Изменение биографии, атрибутов или заметок персонажа".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::Medium,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
            ToolPermissionConfig {
                id: "create_relation".to_string(),
                name: "Создание связи".to_string(),
                description: "Связывание двух сущностей новыми отношениями в графе мира".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::Medium,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
            ToolPermissionConfig {
                id: "create_chapter".to_string(),
                name: "Создание главы".to_string(),
                description: "Добавление новой главы в структуру рукописи".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::Medium,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
            ToolPermissionConfig {
                id: "save_text_blocks".to_string(),
                name: "Правка текста рукописи".to_string(),
                description: "Перезапись или вставка абзацев в существующую главу".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::High,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
        ]
    }
}
