//! Test case: surreal_entity! with duplicate field names should fail to compile.
//! Expected error: duplicate field

use surreal_domain::surreal_entity;

surreal_entity! {
    #[table = "dup_test"]
    pub struct DupEntity {
        pub name: String,
        pub name: i32, // Duplicate field name - should fail
    }
}