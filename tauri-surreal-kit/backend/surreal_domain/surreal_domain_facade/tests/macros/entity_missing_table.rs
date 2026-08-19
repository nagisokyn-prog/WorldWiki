//! Test case: surreal_entity! without #[table = "..."] attribute should fail to compile.
//! Expected error: missing table attribute

use surreal_domain::surreal_entity;

// Missing #[table = "..."] - should fail
surreal_entity! {
    pub struct BrokenEntity {
        pub name: String,
    }
}