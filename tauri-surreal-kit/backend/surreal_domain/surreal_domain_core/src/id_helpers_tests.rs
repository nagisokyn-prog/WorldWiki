use super::*;

#[test]
fn test_invariant_1_exhaustive_table_isolation() {
    let prefixes = ["entities", "characters", "projects", "users", "entities_ext", ""];
    let separators = [":", ""];
    let payloads = ["char_42", "`char_42`", "⟨char_42⟩", "\"char_42\"", "'char_42'", "1", ""];

    for &prefix in &prefixes {
        for &sep in &separators {
            for &payload in &payloads {
                let input = format!("{}{}{}", prefix, sep, payload);
                let res = extract_target_id("entities", &input);
                let expected_some = prefix == "entities" && sep == ":" && !payload.is_empty();
                assert_eq!(
                    res.is_some(),
                    expected_some,
                    "Table isolation failed for input: {:?}",
                    input
                );
            }
        }
    }
}

#[test]
fn test_invariant_2_exhaustive_no_injection() {
    let alphabet = ["a", "_", "1", ":", "{", "\n", "\"", "'", "`"];
    for &c0 in &alphabet {
        for &c1 in &alphabet {
            for &c2 in &alphabet {
                for &c3 in &alphabet {
                    let s = format!("{}{}{}{}", c0, c1, c2, c3);
                    let res = parse_record_id_ref(&s);
                    if s.contains('{')
                        || s.contains('\n')
                        || s.contains('"')
                        || s.contains('\'')
                        || s.contains('`')
                    {
                        assert!(
                            res.is_none(),
                            "Injection character leaked through for input: {:?}",
                            s
                        );
                    }
                }
            }
        }
    }
    assert_eq!(parse_record_id_ref("entities:valid_42"), Some(("entities", "valid_42")));
}

#[test]
fn test_is_not_found_branches() {
    // Syntax and Parse errors should return false
    let parse_lower_err = surrealdb::Error::query("failed to parse statement".to_string(), None);
    assert!(!is_not_found(&parse_lower_err));

    let parse_caps_err = surrealdb::Error::query("Parse error at 1:1".to_string(), None);
    assert!(!is_not_found(&parse_caps_err));

    let syntax_lower_err = surrealdb::Error::query("syntax error near end".to_string(), None);
    assert!(!is_not_found(&syntax_lower_err));

    let syntax_caps_err = surrealdb::Error::query("SurrealDB Syntax error".to_string(), None);
    assert!(!is_not_found(&syntax_caps_err));

    // Not found variants should return true
    let does_not_exist_err = surrealdb::Error::query("table does not exist".to_string(), None);
    assert!(is_not_found(&does_not_exist_err));

    let not_found_lower_err = surrealdb::Error::query("record not found".to_string(), None);
    assert!(is_not_found(&not_found_lower_err));

    let not_found_camel = surrealdb::Error::query("RecordNotFound in table".to_string(), None);
    assert!(is_not_found(&not_found_camel));

    // Generic error returns false
    let generic_err = surrealdb::Error::query("Connection timed out".to_string(), None);
    assert!(!is_not_found(&generic_err));
}

#[test]
fn test_extract_target_id_empty_after_quotes_or_brackets() {
    assert_eq!(extract_target_id("entities", "entities:⟨⟩"), None);
    assert_eq!(extract_target_id("entities", "entities:``"), None);
    assert_eq!(extract_target_id("entities", "entities:\"\""), None);
    assert_eq!(extract_target_id("entities", "entities:''"), None);
    assert_eq!(extract_target_id("entities", "entities:"), None);
    assert_eq!(extract_target_id("entities", "entities"), None);
    assert_eq!(extract_target_id("entities", "entities123"), None);
    assert_eq!(extract_target_id("entities", "entities_xyz:123"), None);
    assert_eq!(extract_target_id("entities", "other:123"), None);
    assert_eq!(extract_target_id("entities", "entities:⟨abc⟩"), Some("abc"));
    assert_eq!(extract_target_id("entities", "entities:plain_id"), Some("plain_id"));
}

