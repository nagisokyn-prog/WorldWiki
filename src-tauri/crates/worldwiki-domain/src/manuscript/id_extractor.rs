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
        let (_, after) = decoded.split_once("data-entity-id=")?;
        let val = after.trim_start_matches(['"', '\''])
            .split(['"', '\'', ' ', '>'])
            .next()?
            .trim();
        (!val.is_empty()).then(|| Self::normalize_record_id(val))
    }

    fn check_query_param_id(decoded: &str) -> Option<String> {
        let (_, after) = decoded.split_once("id=")?;
        let val = after.split(['&', ']', ')', '"', '\'', ' '])
            .next()?
            .trim();
        (!val.is_empty()).then(|| Self::normalize_record_id(val))
    }

    fn check_direct_prefix(decoded: &str) -> Option<String> {
        for prefix in &["entities:", "characters:", "locations:", "items:", "events:"] {
            if let Some(idx) = decoded.find(prefix) {
                let after = decoded.get(idx..)?;
                let end_idx = after.find(|c: char| c.is_whitespace() || ['&', ']', ')', '"', '\''].contains(&c))
                    .unwrap_or(after.len());
                let id = after.get(..end_idx)?;
                if !id.is_empty() {
                    return Some(id.to_string());
                }
            }
        }
        None
    }

    fn normalize_record_id(raw_id: &str) -> String {
        let clean = raw_id.trim_matches(|c| c == '"' || c == '\'' || c == '`');
        if clean.contains(':') {
            clean.to_string()
        } else {
            format!("entities:{}", clean)
        }
    }

    fn url_decode(s: &str) -> String {
        let mut result = String::with_capacity(s.len());
        let mut chars = s.chars().peekable();
        while let Some(c) = chars.next() {
            if c == '%' {
                if let (Some(c1), Some(c2)) = (chars.next(), chars.next()) {
                    let hex = format!("{}{}", c1, c2);
                    if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                        result.push(byte as char);
                        continue;
                    }
                    result.push('%');
                    result.push(c1);
                    result.push(c2);
                    continue;
                }
            }
            result.push(c);
        }
        result
    }
}
