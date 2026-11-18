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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semantic_document_default_and_roundtrip() {
        let doc = SemanticDocument::default();
        assert_eq!(doc.version, 1);
        assert_eq!(doc.root.r#type, "doc");
        assert!(doc.root.children.is_empty());

        let json = serde_json::to_string(&doc).unwrap();
        let decoded: SemanticDocument = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, doc);
    }
}
