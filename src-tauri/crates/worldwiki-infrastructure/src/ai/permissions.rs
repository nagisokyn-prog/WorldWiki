use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use worldwiki_domain::ai::{
    PermissionLevel, RiskLevel, ToolCategory, ToolPermissionConfig,
};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::PermissionsPort;

#[derive(Default, Clone)]
pub struct StaticPermissionsCatalog {
    user_permissions: Arc<RwLock<HashMap<String, PermissionLevel>>>,
}

impl StaticPermissionsCatalog {
    pub fn new() -> Self {
        Self {
            user_permissions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl PermissionsPort for StaticPermissionsCatalog {
    fn get_tool_permissions_catalog(&self) -> Vec<ToolPermissionConfig> {
        let user_map = self.user_permissions.read()
            .map(|m| m.clone())
            .unwrap_or_else(|poison| {
                tracing::warn!("user_permissions RwLock poisoned, recovering inner state: {poison}");
                poison.into_inner().clone()
            });
        let mut list = vec![

            // 1. ПОИСК ПО ВСЕЛЕННОЙ (READ)
            ToolPermissionConfig {
                id: "query_world".to_string(),
                name: "Поиск по вселенной".to_string(),
                description: "Гибридный поиск по лору, главам и сущностям проекта".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 2. ИНСПЕКЦИЯ СУЩНОСТИ (READ)
            ToolPermissionConfig {
                id: "inspect_entity".to_string(),
                name: "Инспекция сущности".to_string(),
                description: "Получение полной анкеты персонажа, локации или предмета по ID или имени".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 3. ЧТЕНИЕ РУКОПИСИ (READ)
            ToolPermissionConfig {
                id: "read_manuscript".to_string(),
                name: "Чтение рукописи".to_string(),
                description: "Чтение текста главы или фрагмента сцены".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 4. ТАЙМЛАЙН И ХРОНОЛОГИЯ (READ)
            ToolPermissionConfig {
                id: "get_timeline".to_string(),
                name: "Таймлайн и хронология".to_string(),
                description: "Просмотр событий и хронологической шкалы проекта".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 5. ГРАФ СВЯЗЕЙ (READ)
            ToolPermissionConfig {
                id: "graph_neighbors".to_string(),
                name: "Граф связей".to_string(),
                description: "Просмотр отношений и смежных узлов графа сущностей".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 6. ПРАВИЛА И ЗАКОНЫ МИРА (READ)
            ToolPermissionConfig {
                id: "get_rules".to_string(),
                name: "Правила мира".to_string(),
                description: "Чтение жестких канонов, магии и законов вселенной".to_string(),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            },
            // 7. ПРЕДЛОЖЕНИЕ ПРАВОК (EDIT / MUTATE)
            ToolPermissionConfig {
                id: "propose_edits".to_string(),
                name: "Предложение правок в текст".to_string(),
                description: "Внесение редакторских правок в текст рукописи".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::High,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
            // 8. ГЕНЕРАЦИЯ АУТЛАЙНА (EDIT / MUTATE)
            ToolPermissionConfig {
                id: "generate_outline".to_string(),
                name: "Генерация структуры и плана".to_string(),
                description: "Создание плана сцены, арки или синопсиса".to_string(),
                category: ToolCategory::Edit,
                risk: RiskLevel::Medium,
                default_level: PermissionLevel::Ask,
                user_level: None,
            },
        ];

        for item in &mut list {
            if let Some(lvl) = user_map.get(&item.id) {
                item.user_level = Some(lvl.clone());
            }
        }

        list
    }

    fn save_tool_permission(&self, tool_id: &str, level: &str) -> Result<(), DomainError> {
        let perm_level = match level.to_lowercase().as_str() {
            "allow" => PermissionLevel::Allow,
            "ask" => PermissionLevel::Ask,
            "deny" => PermissionLevel::Deny,
            _ => PermissionLevel::Ask,
        };
        if let Ok(mut map) = self.user_permissions.write() {
            map.insert(tool_id.to_string(), perm_level);
        }
        Ok(())
    }

    fn save_all_tool_permissions(&self, permissions: &HashMap<String, String>) -> Result<(), DomainError> {
        if let Ok(mut map) = self.user_permissions.write() {
            for (k, v) in permissions {
                let perm_level = match v.to_lowercase().as_str() {
                    "allow" => PermissionLevel::Allow,
                    "ask" => PermissionLevel::Ask,
                    "deny" => PermissionLevel::Deny,
                    _ => PermissionLevel::Ask,
                };
                map.insert(k.clone(), perm_level);
            }
        }
        Ok(())
    }
}

