extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use hashbrown::HashMap;

use crate::types::{CrossReference, ResolvedCrossReference, TargetMetadata};

#[inline(always)]
fn extract_target_meta(target: Option<&TargetMetadata>) -> (bool, Option<String>, Option<String>) {
    match target {
        Some(t) => (true, Some(t.title.clone()), t.path.clone()),
        None => (false, None, None),
    }
}

/// Resolves a collection of cross references against a target lookup map in O(1) per reference.
pub fn resolve_cross_references(
    references: &[CrossReference],
    index: &HashMap<String, TargetMetadata>,
) -> Vec<ResolvedCrossReference> {
    let mut resolved = Vec::with_capacity(references.len());

    for r in references {
        let (is_resolved, target_title, target_path) = extract_target_meta(index.get(&r.target_id));
        resolved.push(ResolvedCrossReference {
            ref_id: r.id.clone(),
            target_id: r.target_id.clone(),
            is_resolved,
            target_title,
            target_path,
        });
    }

    resolved
}

