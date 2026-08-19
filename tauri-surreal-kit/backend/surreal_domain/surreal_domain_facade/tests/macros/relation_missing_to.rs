//! Test case: surreal_relation! without #[to = ...] attribute should fail to compile.
//! Expected error: missing to attribute

use surreal_domain::surreal_relation;

// Missing #[to = ...] - should fail
surreal_relation! {
    #[edge = "knows"]
    #[from = "Person"]
    pub struct BrokenRelation {
        pub since: String,
    }
}