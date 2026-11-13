#[inline]
pub(crate) fn utf8_char_width(b: u8) -> usize {
    if b < 0x80 {
        1
    } else if b < 0xE0 {
        2
    } else if b < 0xF0 {
        3
    } else {
        4
    }
}

pub(crate) fn find_ascii(s: &str, needle: &[u8]) -> Option<usize> {
    let haystack = s.as_bytes();
    let n_len = needle.len();
    if n_len == 0 || haystack.len() < n_len {
        return None;
    }
    let limit = haystack.len() - n_len;
    let mut i = 0;
    while i <= limit {
        let Some(&b) = haystack.get(i) else {
            break;
        };
        if b < 0x80 {
            if haystack.get(i..i + n_len) == Some(needle) {
                return Some(i);
            }
            i += 1;
        } else {
            i += utf8_char_width(b);
        }
    }
    None
}

pub(crate) fn split_once_ascii<'a>(s: &'a str, needle: &[u8]) -> Option<(&'a str, &'a str)> {
    let idx = find_ascii(s, needle)?;
    let before = s.get(..idx)?;
    let after = s.get(idx + needle.len()..)?;
    Some((before, after))
}

pub(crate) fn strip_html_tags(raw: &str) -> String {
    let bytes = raw.as_bytes();
    let mut clean = String::with_capacity(bytes.len());
    let mut in_tag = false;
    let mut chunk_start = 0usize;
    let mut i = 0usize;

    while i < bytes.len() {
        let Some(&b) = bytes.get(i) else {
            break;
        };
        if b == b'<' || b == b'>' {
            if !in_tag
                && chunk_start < i
                && let Some(sub) = raw.get(chunk_start..i)
            {
                clean.push_str(sub);
            }
            in_tag = b == b'<';
            chunk_start = i + 1;
            i += 1;
        } else {
            i += utf8_char_width(b);
        }
    }
    if !in_tag
        && chunk_start < bytes.len()
        && let Some(sub) = raw.get(chunk_start..bytes.len())
    {
        clean.push_str(sub);
    }
    clean.trim_ascii().to_string()
}

