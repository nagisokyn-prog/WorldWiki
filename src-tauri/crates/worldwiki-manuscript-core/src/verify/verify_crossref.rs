use crate::crossref::resolve_cross_references;
use crate::types::{CrossReference, TargetMetadata};
use alloc::string::String;
use alloc::vec;
use hashbrown::HashMap;

#[kani::proof]
#[kani::unwind(6)]
fn proof_crossref_resolution_invariants() {
    let mut index = HashMap::new();
    index.insert(
        String::from("target_1"),
        TargetMetadata {
            title: String::from("Цель 1"),
            path: Some(String::from("/path/1")),
        },
    );

    let mode: u8 = kani::any();
    let target_id = if mode == 0 {
        String::from("target_1")
    } else {
        String::from("target_missing")
    };

    let refs = vec![CrossReference {
        id: String::from("ref_1"),
        target_id: target_id.clone(),
        ref_type: String::from("character"),
        display_label: None,
    }];

    let resolved = resolve_cross_references(&refs, &index);

    assert_eq!(resolved.len(), refs.len());
    assert_eq!(resolved[0].ref_id, refs[0].id);
    assert_eq!(resolved[0].target_id, refs[0].target_id);

    let is_present = index.contains_key(&target_id);
    assert_eq!(resolved[0].is_resolved, is_present);
    assert_eq!(resolved[0].target_title.is_some(), is_present);
}

