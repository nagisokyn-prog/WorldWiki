//! Test case: surreal_entity! with invalid field attribute should fail to compile.
//! Expected error: invalid field attribute

use surreal_domain::surreal_entity;

// Invalid attribute #[invalid_attr] - should fail
surreal_entity! {
    #[table = "invalid_attr_test"]
    pub struct InvalidAttrEntity {
        #[invalid_attr] // Not a valid attribute (valid: fulltext, hnsw, flexible)
        pub name: String,
    }
}