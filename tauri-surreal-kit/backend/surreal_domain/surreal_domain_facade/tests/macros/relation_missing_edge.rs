//! Test case: surreal_relation! without #[edge = ...] attribute should fail to compile.
//! Expected error: missing edge attribute

use surreal_domain::surreal_relation;

// Missing #[edge = ...] - should fail
surreal_relation! {
    #[from = "Person"]
    #[to = "Person"]
    pub struct BrokenRelation {
        pub since: String,
    }
}