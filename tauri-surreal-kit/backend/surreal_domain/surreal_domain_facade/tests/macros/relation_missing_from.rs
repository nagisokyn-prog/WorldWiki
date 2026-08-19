//! Test case: surreal_relation! without #[from = ...] attribute should fail to compile.
//! Expected error: missing from attribute

use surreal_domain::surreal_relation;

// Missing #[from = ...] - should fail
surreal_relation! {
    #[edge = "knows"]
    #[to = "Person"]
    pub struct BrokenRelation {
        pub since: String,
    }
}