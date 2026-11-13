use super::*;
use crate::manuscript::IdExtractor;

#[test]
fn test_invariant_1_exhaustive_utf8_and_slice_safety() {
    let tokens = [
        "((",
        "))",
        "[",
        "]",
        "entities:42",
        "a",
        "Я",
        "東",
        "👑",
        "<a ",
        "</a>",
        ">",
        "%D0%9F",
        "%",
    ];
    for &t0 in &tokens {
        for &t1 in &tokens {
            for &t2 in &tokens {
                let s = format!("{}{}{}", t0, t1, t2);
                let mentions = MentionParser::extract_entity_mentions(&s);
                for m in mentions {
                    assert!(!m.is_empty());
                }
                let _ = IdExtractor::extract_record_id_from_metadata(&s);
            }
        }
    }
}

#[test]
fn test_invariant_2_exhaustive_clean_entity_mention_idempotence() {
    let alphabet = ["<", ">", " ", "a", "Я", "👑", "\0"];
    for &c0 in &alphabet {
        for &c1 in &alphabet {
            for &c2 in &alphabet {
                for &c3 in &alphabet {
                    let s = format!("{}{}{}{}", c0, c1, c2, c3);
                    let s1 = MentionParser::clean_entity_mention(&s);
                    let s2 = MentionParser::clean_entity_mention(&s1);
                    assert_eq!(s1, s2, "Failed idempotence for: {:?}", s);
                }
            }
        }
    }
}

#[test]
fn test_invariant_3_no_redos_and_crash_freedom() {
    let pathological = [
        "(".repeat(10_000),
        "((".repeat(5_000),
        "<a href=\"unclosed".repeat(2_000),
        "<span data-entity-id=\"entities:1\"".repeat(2_000),
        "[link](entities:1".repeat(2_000),
        "((\0\0\0))[\0entities:null_test\0]".repeat(1_000),
    ];
    for sample in &pathological {
        let _ = MentionParser::extract_entity_mentions(sample);
        let _ = IdExtractor::extract_record_id_from_metadata(sample);
    }
}

