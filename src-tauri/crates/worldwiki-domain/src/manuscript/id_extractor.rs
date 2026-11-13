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
            let Some(idx) = find_ascii(decoded, prefix) else {
                continue;
            };
            let after = decoded.get(idx..)?;
            let id = after
                .split(|c: char| c.is_ascii_whitespace() || matches!(c, '&' | ']' | ')' | '"' | '\''))
                .next()
                .unwrap_or("");
            if !id.is_empty() {
                return Some(id.to_string());
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

    fn decode_hex_pair(h1: u8, h2: u8) -> Option<u8> {
        let hex = [h1, h2];
        let hex_str = core::str::from_utf8(&hex).ok()?;
        u8::from_str_radix(hex_str, 16).ok()
    }

    fn url_decode(s: &str) -> String {
        if find_ascii(s, b"%").is_none() {
            return s.to_string();
        }
        let mut bytes = Vec::with_capacity(s.len());
        let mut iter = s.as_bytes().iter().copied();
        while let Some(b) = iter.next() {
            if b != b'%' {
                bytes.push(b);
                continue;
            }
            match (iter.next(), iter.next()) {
                (Some(h1), Some(h2)) => {
                    if let Some(val) = Self::decode_hex_pair(h1, h2) {
                        bytes.push(val);
                    } else {
                        bytes.extend_from_slice(&[b'%', h1, h2]);
                    }
                }
                (Some(h1), None) => {
                    bytes.extend_from_slice(&[b'%', h1]);
                    break;
                }
                _ => {
                    bytes.push(b'%');
                    break;
                }
            }
        }
        String::from_utf8_lossy(&bytes).into_owned()
    }
}
