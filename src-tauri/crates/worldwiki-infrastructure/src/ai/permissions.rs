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
            // 1. ПОИСК ПО ВСЕЛЕННОЙ (READ)
            ToolPermissionConfig {
                id: "query_world".to_string(),
                name: "Поиск по вселенной (query_world)".to_string(),
                description: "Гибридный поиск по лору, главам и сущностям проекта".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 2. ИНСПЕКЦИЯ СУЩНОСТИ (READ)
            ToolPermissionConfig {
                id: "inspect_entity".to_string(),
                name: "Инспекция сущности (inspect_entity)".to_string(),
                description: "Получение полной анкеты персонажа, локации или предмета по ID или имени".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 3. ЧТЕНИЕ РУКОПИСИ (READ)
            ToolPermissionConfig {
                id: "read_manuscript".to_string(),
                name: "Чтение рукописи (read_manuscript)".to_string(),
                description: "Чтение текста главы или фрагмента сцены".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 4. ТАЙМЛАЙН И ХРОНОЛОГИЯ (READ)
            ToolPermissionConfig {
                id: "get_timeline".to_string(),
                name: "Таймлайн и Хронология (get_timeline)".to_string(),
                description: "Просмотр событий и хронологической шкалы проекта".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 5. ГРАФ СВЯЗЕЙ (READ)
            ToolPermissionConfig {
                id: "graph_neighbors".to_string(),
                name: "Граф связей (graph_neighbors)".to_string(),
                description: "Просмотр отношений и смежных узлов графа сущностей".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 6. ПРАВИЛА И ЗАКОНЫ МИРА (READ)
            ToolPermissionConfig {
                id: "get_rules".to_string(),
                name: "Правила мира (get_rules)".to_string(),
                description: "Чтение жестких канонов, магии и законов вселенной".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 7. ПРЕДЛОЖЕНИЕ ПРАВОК (EDIT / MUTATE)
            ToolPermissionConfig {
                id: "propose_edits".to_string(),
                name: "Предложение правок в текст (propose_edits)".to_string(),
                description: "Внесение редакторских правок в текст рукописи".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::High,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
            // 8. ГЕНЕРАЦИЯ АУТЛАЙНА (EDIT / MUTATE)
            ToolPermissionConfig {
                id: "generate_outline".to_string(),
                name: "Генерация структуры и плана (generate_outline)".to_string(),
                description: "Создание плана сцены, арки или синопсиса".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::Medium,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
        ]
    }
}
