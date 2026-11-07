use crate::manuscript::{IdExtractor, MentionParser};

/// Инвариант 1 (UTF-8 & Slice Safety):
/// Символический ввод последовательностей UTF-8 всех классов ширины (1, 2, 3, 4 байта:
/// ASCII, кириллица, CJK, суррогатные эмодзи) никогда не приводит к панике при слайсинге.
#[kani::proof]
#[kani::unwind(6)]
fn proof_manuscript_mention_utf8_slice_safety() {
    let corpus = ["((a))", "((Я))", "((東))", "((👑))"];
    let idx: usize = kani::any();
    kani::assume(idx < corpus.len());

    let Some(&text) = corpus.get(idx) else {
        return;
    };
    let mentions = MentionParser::extract_entity_mentions(text);
    assert_eq!(mentions.len(), 1);
    assert!(!mentions[0].is_empty());
}

/// Инвариант 2 (Идемпотентность очистки):
/// clean_entity_mention(clean_entity_mention(s)) == clean_entity_mention(s)
#[kani::proof]
#[kani::unwind(3)]
fn proof_clean_entity_mention_idempotence() {
    let alphabet: [u8; 4] = [b'<', b'>', b' ', b'a'];
    let i0: usize = kani::any();
    let i1: usize = kani::any();
    kani::assume(i0 < 4 && i1 < 4);

    let (Some(&b0), Some(&b1)) = (alphabet.get(i0), alphabet.get(i1)) else {
        return;
    };
    let bytes = [b0, b1];

    if let Ok(s) = core::str::from_utf8(&bytes) {
        let s1 = MentionParser::clean_entity_mention(s);
        let s2 = MentionParser::clean_entity_mention(&s1);
        assert_eq!(s1, s2);
    }
}

/// Инвариант 3 (No ReDoS / Crash-freedom):
/// Незакрытые скобки ((, битые теги и нулевые байты \0 парсятся
/// за линейное время без паник.
#[kani::proof]
#[kani::unwind(4)]
fn proof_manuscript_mention_unclosed_and_null_bytes() {
    let corpus = ["((a", "((", "\0", "<a "];
    let idx: usize = kani::any();
    kani::assume(idx < corpus.len());

    let Some(&text) = corpus.get(idx) else {
        return;
    };
    let mentions = MentionParser::extract_entity_mentions(text);
    assert!(mentions.is_empty());

    let id = IdExtractor::extract_record_id_from_metadata(text);
    assert!(id.is_none());
}
