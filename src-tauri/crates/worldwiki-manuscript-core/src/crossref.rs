extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use hashbrown::HashMap;

use crate::types::{CrossReference, ResolvedCrossReference, TargetMetadata};

/// Resolves a collection of cross references against a target lookup map in O(1) per reference.
pub fn resolve_cross_references(
    references: &[CrossReference],
    index: &HashMap<String, TargetMetadata>,
) -> Vec<ResolvedCrossReference> {
    let mut resolved = Vec::with_capacity(references.len());

    for r in references {
        if let Some(target) = index.get(&r.target_id) {
            resolved.push(ResolvedCrossReference {
                ref_id: r.id.clone(),
                target_id: r.target_id.clone(),
                is_resolved: true,
                target_title: Some(target.title.clone()),
                target_path: target.path.clone(),
            });
        } else {
            resolved.push(ResolvedCrossReference {
                ref_id: r.id.clone(),
                target_id: r.target_id.clone(),
                is_resolved: false,
                target_title: None,
                target_path: None,
            });
        }
    }

    resolved
}

