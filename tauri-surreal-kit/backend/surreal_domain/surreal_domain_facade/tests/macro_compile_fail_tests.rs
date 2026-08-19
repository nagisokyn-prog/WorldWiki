//! Compile-fail tests for surreal_domain macros using trybuild.
//! These tests verify that macros produce clear, actionable error messages
//! when used incorrectly.

#[cfg(test)]
mod compile_fail_tests {
    use trybuild::TestCases;

    #[test]
    fn entity_missing_table_attribute() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/entity_missing_table.rs");
    }

    #[test]
    fn entity_duplicate_fields() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/entity_duplicate_fields.rs");
    }

    #[test]
    fn relation_missing_from_attribute() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/relation_missing_from.rs");
    }

    #[test]
    fn relation_missing_to_attribute() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/relation_missing_to.rs");
    }

    #[test]
    fn relation_missing_edge_attribute() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/relation_missing_edge.rs");
    }

    #[test]
    fn schema_missing_entities() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/schema_missing_entities.rs");
    }

    #[test]
    fn entity_invalid_field_attribute() {
        let t = TestCases::new();
        t.compile_fail("tests/macros/entity_invalid_field_attribute.rs");
    }
}