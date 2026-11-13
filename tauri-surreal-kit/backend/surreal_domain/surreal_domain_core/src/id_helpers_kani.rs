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

