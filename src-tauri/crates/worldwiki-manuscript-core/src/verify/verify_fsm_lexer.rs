use crate::fsm_lexer::extract_entity_mentions;

#[kani::proof]
#[kani::unwind(6)]
fn proof_fsm_arbitrary_utf8_no_panic_and_char_boundaries() {
    let idx: usize = kani::any();
    let corpus = ["((a))", "((Я))", "((東))", "((👑))"];
    kani::assume(idx < corpus.len());

    let Some(&text) = corpus.get(idx) else { return; };
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

#[kani::proof]
#[kani::unwind(5)]
fn proof_fsm_mention_structural_invariants() {
    let alphabet: [u8; 4] = [b'(', b')', b'\\', b'a'];
    let i0: usize = kani::any();
    let i1: usize = kani::any();
    let i2: usize = kani::any();

    kani::assume(i0 < 4 && i1 < 4 && i2 < 4);

    let (Some(&b0), Some(&b1), Some(&b2)) =
        (alphabet.get(i0), alphabet.get(i1), alphabet.get(i2))
    else {
        return;
    };

    let bytes = [b0, b1, b2];

    if let Ok(text) = core::str::from_utf8(&bytes) {
        let mentions = extract_entity_mentions(text);

        for m in mentions {
            assert!(m.byte_start + 4 <= m.byte_end);
            assert_eq!(&text[m.byte_start..m.byte_start + 2], "((");
            assert_eq!(&text[m.byte_end - 2..m.byte_end], "))");
            assert!(!m.name.is_empty());
        }
    }
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_fsm_escape_sequence_never_triggers() {
    let text = "\\((a))";
    let mentions = extract_entity_mentions(text);
    assert!(mentions.is_empty());
}

#[kani::proof]
#[kani::unwind(6)]
fn proof_fsm_newline_breaker_invariant() {
    let mode: u8 = kani::any();
    let text = if mode == 0 { "((a\nb))" } else { "((a\rb))" };

    let mentions = extract_entity_mentions(text);
    assert!(mentions.is_empty());
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_fsm_depth_saturating_no_underflow() {
    let mode: u8 = kani::any();
    let text = if mode == 0 { "((a)b))" } else { "(((a)))" };

    let mentions = extract_entity_mentions(text);
    assert_eq!(mentions.len(), 1);
}
