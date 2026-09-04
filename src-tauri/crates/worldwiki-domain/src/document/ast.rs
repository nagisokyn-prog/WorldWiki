use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AstNode {
    pub r#type: String, // "paragraph", "heading", "entity_mention", "dialogue", "text"
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub attrs: Option<Value>,
    #[serde(default)]
    pub children: Vec<AstNode>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SemanticDocument {
    pub version: u32,
    pub title: String,
    pub root: AstNode,
}

impl Default for SemanticDocument {
    fn default() -> Self {
        Self {
            version: 1,
            title: String::new(),
            root: AstNode {
                r#type: "doc".to_string(),
                content: None,
                attrs: None,
                children: Vec::new(),
            },
        }
    }
}
