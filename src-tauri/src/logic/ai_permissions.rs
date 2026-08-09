use serde_json::Value;

pub struct ToolPermissionRequest {
    pub tool_name: String,
    pub entity_type: Option<String>, // e.g., "character", "organization" for create/update entity
    pub relation_type: Option<String>, // e.g., "friendship" for create_relation
    pub path: Option<String>, // e.g., "volume_1" for chapter edits
}

/// Checks if a given tool request is auto-approved according to the settings.
/// Returns true if approved, false if requires manual user approval.
pub fn check_permissions(settings: &Value, request: &ToolPermissionRequest) -> bool {
    let enabled = settings.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
    if !enabled {
        return false; // Global switch is OFF, always require approval
    }

    let categories = settings.get("categories").unwrap_or(&Value::Null);
    let allowlist = settings.get("allowlist").unwrap_or(&Value::Null);
    let denylist = settings.get("denylist").unwrap_or(&Value::Null);

    // 1. Delete operations NEVER auto-approve
    if request.tool_name.starts_with("delete_") {
        return false;
    }

    // 2. Denylist check (highest priority)
    if let Some(entity_type) = &request.entity_type {
        if check_in_list(denylist, "entity_types", entity_type) {
            return false;
        }
    }
    if let Some(relation_type) = &request.relation_type {
        if check_in_list(denylist, "rel_types", relation_type) {
            return false;
        }
    }
    if let Some(path) = &request.path {
        if check_in_list(denylist, "paths", path) {
            return false;
        }
    }

    // 3. Category level check
    let category = get_category_for_tool(&request.tool_name);
    let is_category_approved = categories
        .get(&category)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !is_category_approved {
        // If category is not approved, we check if it is explicitly in allowlist
        // Allowlist only overrides if the item is explicitly there
        let mut allowlisted = false;
        if let Some(entity_type) = &request.entity_type {
            if check_in_list(allowlist, "entity_types", entity_type) {
                allowlisted = true;
            }
        }
        if let Some(relation_type) = &request.relation_type {
            if check_in_list(allowlist, "rel_types", relation_type) {
                allowlisted = true;
            }
        }
        if let Some(path) = &request.path {
            if check_in_list(allowlist, "paths", path) {
                allowlisted = true;
            }
        }
        
        if !allowlisted {
            return false;
        }
    }

    // Passed all checks!
    true
}

fn check_in_list(list: &Value, key: &str, target: &str) -> bool {
    if let Some(arr) = list.get(key).and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                if s == target {
                    return true;
                }
            }
        }
    }
    false
}

fn get_category_for_tool(tool_name: &str) -> String {
    if tool_name.starts_with("get_") || tool_name.starts_with("search_") {
        return "read".to_string();
    }
    if tool_name.contains("entity") || tool_name.contains("entities") {
        return "edit_entities".to_string();
    }
    if tool_name.contains("relation") {
        return "edit_relations".to_string();
    }
    if tool_name.contains("chapter") || tool_name.contains("volume") || tool_name.contains("arc") {
        return "edit_content".to_string();
    }
    if tool_name.contains("calendar") || tool_name.contains("timeline") {
        return "edit_calendar".to_string();
    }
    if tool_name.contains("analyze") || tool_name.contains("contradiction") || tool_name.contains("evolution") {
        return "analyze".to_string();
    }
    
    // Default fallback
    "unknown".to_string()
}
