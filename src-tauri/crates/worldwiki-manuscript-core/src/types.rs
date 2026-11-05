extern crate alloc;

use alloc::string::String;

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct ExtractedEntityMention {
    pub name: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub char_start: usize,
    pub char_end: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CrossReference {
    pub id: String,
    pub target_id: String,
    pub ref_type: String,
    #[cfg_attr(feature = "serde", serde(default))]
    pub display_label: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct ResolvedCrossReference {
    pub ref_id: String,
    pub target_id: String,
    pub is_resolved: bool,
    #[cfg_attr(feature = "serde", serde(default))]
    pub target_title: Option<String>,
    #[cfg_attr(feature = "serde", serde(default))]
    pub target_path: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct TargetMetadata {
    pub title: String,
    pub path: Option<String>,
}

