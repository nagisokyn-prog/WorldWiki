//! Test case: surreal_schema! with empty entities should fail to compile.
//! Expected error: at least one entity required

use surreal_domain::{surreal_entity, surreal_schema};

surreal_entity! {
    #[table = "test_entity"]
    pub struct TestEntity {
        pub name: String,
    }
}

// Empty entities array - should fail
surreal_schema! {
    entities: [],
    relations: []
}