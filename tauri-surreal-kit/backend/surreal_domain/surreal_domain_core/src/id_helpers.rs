pub use crate::json_helpers::{normalize_embedded_things, normalize_map_record_ids};

/// Helper to check if a surrealdb error indicates a non-existent table/record.
pub fn is_not_found(e: &surrealdb::Error) -> bool {
    e.to_string().contains("does not exist")
}

pub use is_not_found as is_record_not_found;

/// Safely parse a record id string into (table, raw_id) without slice indexing.
/// Rejects injection characters: '{', '\n', quotes, and backticks.
pub fn parse_record_id_ref(s: &str) -> Option<(&str, &str)> {
    let bytes = s.as_bytes();
    let mut colon_idx = None;
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'{' || b == b'\n' || b == b'"' || b == b'\'' || b == b'`' {
            return None;
        }
        if colon_idx.is_none() {
            if b == b':' {
                colon_idx = Some(i);
            } else if !(b.is_ascii_alphanumeric() || b == b'_') {
                return None;
            }
        }
        i += 1;
    }
    let idx = colon_idx?;
    if idx == 0 || idx + 1 >= bytes.len() {
        return None;
    }
    let tb = s.get(..idx)?;
    let id = s.get(idx + 1..)?;
    Some((tb, id))
}

/// Extract actual record ID for a target table, returning None if the table prefix mismatches.
/// Returns Some(raw_id) if and only if the prefix matches the target table.
pub fn extract_target_id<'a>(table: &str, id: &'a str) -> Option<&'a str> {
    let bytes = id.as_bytes();
    let t_bytes = table.as_bytes();
    if bytes.len() <= t_bytes.len() || bytes.get(t_bytes.len()) != Some(&b':') {
        return None;
    }
    if bytes.get(..t_bytes.len()) != Some(t_bytes) {
        return None;
    }
    let r = id.get(t_bytes.len() + 1..)?;
    let r = r
        .strip_prefix('⟨')
        .or_else(|| r.strip_prefix(['`', '"', '\'']))
        .unwrap_or(r);
    let r = r
        .strip_suffix('⟩')
        .or_else(|| r.strip_suffix(['`', '"', '\'']))
        .unwrap_or(r);
    Some(r)
}

#[cfg(any(kani, feature = "kani"))]
pub mod verify {
    use super::*;

    #[kani::proof]
    #[kani::unwind(3)]
    fn proof_extract_target_id_table_isolation() {
        let candidates = [
            "entities:a",
            "entities:`1`",
            "entities:0",
            "users:a",
            "char_42",
            ":a",
            "",
        ];
        let idx: usize = kani::any();
        kani::assume(idx < candidates.len());

        let Some(&id) = candidates.get(idx) else {
            return;
        };
        let res = extract_target_id("entities", id);
        let has_entities_prefix = id.starts_with("entities:");
        assert_eq!(res.is_some(), has_entities_prefix);
    }

    #[kani::proof]
    #[kani::unwind(4)]
    fn proof_parse_record_id_ref_no_injection() {
        let alphabet: [u8; 6] = [b'a', b'{', b'\n', b'"', b'\'', b'`'];
        let i0: usize = kani::any();
        kani::assume(i0 < 6);

        let Some(&b0) = alphabet.get(i0) else {
            return;
        };
        let bytes = [b'e', b':', b0];
        if let Ok(s) = core::str::from_utf8(&bytes) {
            if b0 == b'{' || b0 == b'\n' || b0 == b'"' || b0 == b'\'' || b0 == b'`' {
                assert!(parse_record_id_ref(s).is_none());
            } else {
                assert_eq!(parse_record_id_ref(s), Some(("e", "a")));
            }
        }
    }
}

#[cfg(test)]
mod tests {
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
}
