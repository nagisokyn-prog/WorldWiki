/// Safely parse a record id string into (table, raw_id) without slice indexing.
/// Rejects injection characters: '{', '\n', quotes, and backticks.
pub fn parse_record_id_ref(s: &str) -> Option<(&str, &str)> {
    let bytes = s.as_bytes();
    let mut colon_idx = None;
    for (i, &b) in bytes.iter().enumerate() {
        if matches!(b, b'{' | b'\n' | b'"' | b'\'' | b'`') {
            return None;
        }
        if colon_idx.is_none() {
            if b == b':' {
                colon_idx = Some(i);
            } else if !(b.is_ascii_alphanumeric() || b == b'_') {
                return None;
            }
        }
    }
    let idx = colon_idx?;
    if idx == 0 || idx + 1 >= bytes.len() {
        return None;
    }
    Some((s.get(..idx)?, s.get(idx + 1..)?))
}

