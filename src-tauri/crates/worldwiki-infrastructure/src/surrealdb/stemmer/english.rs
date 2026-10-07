use super::vowels::is_english_vowel;

pub(crate) fn stem_english(word: &str) -> String {
    let mut s = word.to_string();
    if s.len() <= 2 {
        return s;
    }

    // Step 1a: sses -> ss, ies -> i, ss -> ss, s -> ''
    if s.ends_with("sses") || s.ends_with("ies") {
        s.truncate(s.len() - 2);
    } else if !s.ends_with("ss") && s.ends_with('s') {
        s.pop();
    }

    // Step 1b: eed, ed, ing
    if s.ends_with("eed") {
        // keep
    } else if let Some(stem) = s.strip_suffix("ed") {
        if stem.chars().any(is_english_vowel) {
            s = stem.to_string();
            if s.ends_with("at") || s.ends_with("bl") || s.ends_with("iz") {
                s.push('e');
            }
        }
    } else if let Some(stem) = s.strip_suffix("ing")
        && stem.chars().any(is_english_vowel) {
            s = stem.to_string();
            if s.ends_with("at") || s.ends_with("bl") || s.ends_with("iz") {
                s.push('e');
            }
        }

    // Step 1c: y -> i if vowel in stem
    if let Some(stem) = s.strip_suffix('y')
        && stem.chars().any(is_english_vowel) {
            s = format!("{stem}i");
        }

    s
}
