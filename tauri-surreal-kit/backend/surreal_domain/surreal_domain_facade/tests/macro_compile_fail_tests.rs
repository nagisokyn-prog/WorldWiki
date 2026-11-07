//! Compile-fail tests for surreal_domain macros using trybuild.
//! These tests verify that macros produce clear, actionable error messages
//! when used incorrectly.

#[cfg(test)]
mod compile_fail_tests {
    use trybuild::TestCases;

    #[test]
    fn macro_compile_fail_suite() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/entity_missing_table.rs");
        t.compile_fail("tests/macros/entity_duplicate_fields.rs");
        t.compile_fail("tests/macros/relation_missing_from.rs");
        t.compile_fail("tests/macros/relation_missing_to.rs");
        t.compile_fail("tests/macros/relation_missing_edge.rs");
        t.compile_fail("tests/macros/schema_missing_entities.rs");
        t.compile_fail("tests/macros/entity_invalid_field_attribute.rs");
    }
}