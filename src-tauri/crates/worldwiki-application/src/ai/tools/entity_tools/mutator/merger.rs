use serde_json::{Map, Value};

const RESERVED_KEYS: &[&str] = &[
    "id",
    "project_id",
    "projectId",
    "type_key",
    "entity_type",
    "type",
    "name",
    "tags",
    "created_at",
    "updated_at",
    "description",
    "описание",
];

pub fn merge_entity_tags(existing_tags: Vec<String>, new_tags_val: Option<&Value>) -> Vec<String> {
    let mut tags = existing_tags;
    if let Some(new_tags) = new_tags_val.and_then(|v| v.as_array()) {
        for t in new_tags
            .iter()
            .filter_map(|x| x.as_str().map(|s| s.to_string()))
        {
            if !tags.contains(&t) {
                tags.push(t);
            }
        }
    }
    tags
}

pub fn merge_attributes_and_extra_fields(
    mut base_attributes: Map<String, Value>,
    mut obj: Map<String, Value>,
    name: &str,
    description: Option<&str>,
) -> Map<String, Value> {
    if let Some(Value::Object(incoming_attrs)) = obj.remove("attributes") {
        for (k, v) in incoming_attrs {
            base_attributes.insert(k, v);
        }
    }

    base_attributes.insert("название".to_string(), Value::String(name.to_string()));
    if let Some(d) = description {
        base_attributes.insert("описание".to_string(), Value::String(d.to_string()));
    }

    for (k, v) in obj {
        if !RESERVED_KEYS.contains(&k.as_str()) {
            base_attributes.insert(k, v);
        }
    }

    base_attributes
}
