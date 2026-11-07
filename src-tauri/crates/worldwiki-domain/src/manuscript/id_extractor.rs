use crate::manuscript::mention_parser::{find_ascii, split_once_ascii};

pub struct IdExtractor;

impl IdExtractor {
    pub fn extract_record_id_from_metadata(raw: &str) -> Option<String> {
        let decoded = Self::url_decode(raw);
        if let Some(id) = Self::check_data_entity_id(&decoded) {
            return Some(id);
        }
        if let Some(id) = Self::check_query_param_id(&decoded) {
            return Some(id);
        }
        Self::check_direct_prefix(&decoded)
    }

    fn check_data_entity_id(decoded: &str) -> Option<String> {
        let (_, after) = split_once_ascii(decoded, b"data-entity-id=")?;
        let val = after
            .trim_start_matches(['"', '\''])
            .split(['"', '\'', ' ', '>'])
            .next()?
            .trim_ascii();
        (!val.is_empty()).then(|| Self::normalize_record_id(val))
    }

    fn check_query_param_id(decoded: &str) -> Option<String> {
        let (_, after) = split_once_ascii(decoded, b"id=")?;
        let val = after
            .split(['&', ']', ')', '"', '\'', ' '])
            .next()?
            .trim_ascii();
        (!val.is_empty()).then(|| Self::normalize_record_id(val))
    }

    fn check_direct_prefix(decoded: &str) -> Option<String> {
        const PREFIXES: &[&[u8]] = &[
            b"entities:",
            b"characters:",
            b"locations:",
            b"items:",
            b"events:",
        ];
        for &prefix in PREFIXES {
            if let Some(idx) = find_ascii(decoded, prefix) {
                let after = decoded.get(idx..)?;
                let after_bytes = after.as_bytes();
                let mut end_idx = after_bytes.len();
                let mut i = 0;
                while i < after_bytes.len() {
                    let b = after_bytes[i];
                    if b.is_ascii_whitespace()
                        || b == b'&'
                        || b == b']'
                        || b == b')'
                        || b == b'"'
                        || b == b'\''
                    {
                        end_idx = i;
                        break;
                    }
                    i += 1;
                }
                let id = after.get(..end_idx)?;
                if !id.is_empty() {
                    return Some(id.to_string());
                }
            }
        }
        None
    }

    fn normalize_record_id(raw_id: &str) -> String {
        let clean = raw_id.trim_matches(['"', '\'', '`']);
        if find_ascii(clean, b":").is_some() {
            clean.to_string()
        } else {
            format!("entities:{}", clean)
        }
    }

    fn url_decode(s: &str) -> String {
        if find_ascii(s, b"%").is_none() {
            return s.to_string();
        }
        let mut bytes = Vec::with_capacity(s.len());
        let mut chars = s.as_bytes().iter().copied().peekable();
        while let Some(b) = chars.next() {
            if b == b'%' {
                let c1 = chars.next();
                let c2 = chars.next();
                if let (Some(h1), Some(h2)) = (c1, c2) {
                    let hex = [h1, h2];
                    if let Ok(hex_str) = core::str::from_utf8(&hex)
                        && let Ok(val) = u8::from_str_radix(hex_str, 16)
                    {
                        bytes.push(val);
                        continue;
                    }
                    bytes.push(b'%');
                    bytes.push(h1);
                    bytes.push(h2);
                    continue;
                } else {
                    bytes.push(b'%');
                    if let Some(h1) = c1 {
                        bytes.push(h1);
                    }
                    break;
                }
            } else {
                bytes.push(b);
            }
        }
        String::from_utf8_lossy(&bytes).into_owned()
    }
}
