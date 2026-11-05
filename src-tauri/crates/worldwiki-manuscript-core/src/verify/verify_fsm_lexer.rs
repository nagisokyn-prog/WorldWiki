use crate::fsm_lexer::extract_entity_mentions;

#[kani::proof]
#[kani::unwind(10)]
fn proof_fsm_arbitrary_utf8_no_panic_and_char_boundaries() {
    let bytes: [u8; 6] = kani::any();
    if let Ok(text) = core::str::from_utf8(&bytes) {
        let mentions = extract_entity_mentions(text);

        for m in mentions {
            assert!(m.byte_start <= m.byte_end);
            assert!(m.byte_end <= text.len());
            assert!(m.char_start <= m.char_end);

            assert!(text.is_char_boundary(m.byte_start));
            assert!(text.is_char_boundary(m.byte_end));
            assert!(!m.name.is_empty());
        }
    }
}

#[kani::proof]
#[kani::unwind(12)]
fn proof_fsm_mention_structural_invariants() {
    let bytes: [u8; 8] = kani::any();
    if let Ok(text) = core::str::from_utf8(&bytes) {
        let mentions = extract_entity_mentions(text);

        for m in mentions {
            assert!(m.byte_start + 4 <= m.byte_end);
            assert_eq!(&text[m.byte_start..m.byte_start + 2], "((");
            assert_eq!(&text[m.byte_end - 2..m.byte_end], "))");
        }
    }
}

#[kani::proof]
#[kani::unwind(8)]
fn proof_fsm_escape_sequence_never_triggers() {
    let text = "\\((Экранировано))";
    let mentions = extract_entity_mentions(text);
    assert!(mentions.is_empty());
}

#[kani::proof]
#[kani::unwind(8)]
fn proof_fsm_newline_breaker_invariant() {
    let mode: u8 = kani::any();
    let text = if mode == 0 {
        "((Имя\nФамилия))"
    } else {
        "((Имя\rФамилия))"
    };

    let mentions = extract_entity_mentions(text);
    assert!(mentions.is_empty());
}

#[kani::proof]
#[kani::unwind(10)]
fn proof_fsm_depth_saturating_no_underflow() {
    let text = "(((())(()))))))";
    let _ = extract_entity_mentions(text);
}

