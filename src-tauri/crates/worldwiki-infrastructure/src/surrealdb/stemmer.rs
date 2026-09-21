//! Robust, self-contained Cyrillic (Russian) and Latin (English) Snowball stemmer
//! for fuzzy entity matching and search across all grammatical cases and declensions.

pub struct SnowballStemmer;

impl SnowballStemmer {
    /// Stem a single word (detects Cyrillic vs Latin automatically)
    pub fn stem_word(word: &str) -> String {
        let clean = word.trim().to_lowercase().replace('ё', "е");
        if clean.is_empty() {
            return clean;
        }

        // Check if word contains Cyrillic characters
        let is_cyrillic = clean.chars().any(|c| ('\u{0400}'..='\u{04FF}').contains(&c));

        if is_cyrillic {
            Self::stem_russian(&clean)
        } else {
            Self::stem_english(&clean)
        }
    }

    /// Stem an entire phrase/query into space-separated stems
    pub fn stem_phrase(phrase: &str) -> String {
        phrase
            .split_whitespace()
            .map(Self::stem_word)
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" ")
    }


    // --- Russian Snowball Stemming Algorithm ---
    fn is_russian_vowel(c: char) -> bool {
        matches!(c, 'а' | 'е' | 'и' | 'о' | 'у' | 'ы' | 'э' | 'ю' | 'я')
    }

    fn stem_russian(word: &str) -> String {
        let chars: Vec<char> = word.chars().collect();
        if chars.len() <= 3 {
            return word.to_string();
        }

        // Find RV region (region after first vowel)
        let rv_pos = match chars.iter().position(|&c| Self::is_russian_vowel(c)) {
            Some(pos) => pos + 1,
            None => return word.to_string(),
        };

        if rv_pos >= chars.len() {
            return word.to_string();
        }

        let mut rv: String = chars[rv_pos..].iter().collect();
        let prefix: String = chars[..rv_pos].iter().collect();

        // Step 1: Remove perfective gerund, adjective, participle, reflexive, verb, or noun endings
        if !Self::strip_russian_perfective_gerund(&mut rv) {
            Self::strip_russian_reflexive(&mut rv);
            if !Self::strip_russian_adjective(&mut rv)
                && !Self::strip_russian_verb(&mut rv) {
                Self::strip_russian_noun(&mut rv);
            }
        }


        // Step 2: Remove 'и' ending
        if rv.ends_with('и') {
            rv.pop();
        }

        // Step 3: Remove derivational endings
        Self::strip_russian_derivational(&mut rv);

        // Step 4: Undouble 'нн' -> 'н', remove superlative or soft sign
        if rv.ends_with("нн") {
            rv.pop();
        }
        Self::strip_russian_superlative(&mut rv);
        if rv.ends_with('ь') {
            rv.pop();
        }

        format!("{prefix}{rv}")
    }

    fn strip_russian_perfective_gerund(rv: &mut String) -> bool {
        let endings_group1 = ["в", "вши", "вшись"];
        let endings_group2 = ["ив", "ивши", "ившись", "ыв", "ывши", "ывшись"];

        for ending in endings_group2 {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                return true;
            }
        }
        for ending in endings_group1 {
            if rv.ends_with(ending) {
                let rest = &rv[..rv.len() - ending.len()];
                if rest.ends_with('а') || rest.ends_with('я') {
                    rv.truncate(rv.len() - ending.len());
                    return true;
                }
            }
        }
        false
    }

    fn strip_russian_reflexive(rv: &mut String) -> bool {
        for ending in ["ся", "сь"] {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                return true;
            }
        }
        false
    }

    fn strip_russian_adjective(rv: &mut String) -> bool {
        let endings = [
            "ее", "ие", "ые", "ое", "ими", "ыми", "ей", "ий", "ый", "ой",
            "ем", "им", "ым", "ом", "его", "ого", "ему", "ому", "их", "ых",
            "ую", "юю", "ая", "яя", "ою", "ею"
        ];
        for ending in endings {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                // Also check if preceded by participle ending
                Self::strip_russian_participle(rv);
                return true;
            }
        }
        false
    }

    fn strip_russian_participle(rv: &mut String) -> bool {
        let endings_group1 = ["ем", "нн", "вш", "ющ", "щ"];
        let endings_group2 = ["ивш", "ывш", "ующ"];

        for ending in endings_group2 {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                return true;
            }
        }
        for ending in endings_group1 {
            if rv.ends_with(ending) {
                let rest = &rv[..rv.len() - ending.len()];
                if rest.ends_with('а') || rest.ends_with('я') {
                    rv.truncate(rv.len() - ending.len());
                    return true;
                }
            }
        }
        false
    }

    fn strip_russian_verb(rv: &mut String) -> bool {
        let endings_group1 = [
            "ла", "на", "ете", "йте", "ли", "й", "л", "ем", "н", "ло", "но", "ет", "ют", "ны", "ть", "ешь", "нно"
        ];
        let endings_group2 = [
            "ила", "ыла", "ена", "ейте", "уйте", "ите", "или", "ыли", "ей", "уй", "ил", "ыл",
            "им", "ым", "ен", "ило", "ыло", "ено", "ят", "ует", "уют", "ит", "ыт", "ены", "ить",
            "ыть", "ишь", "ей", "ейте"
        ];

        for ending in endings_group2 {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                return true;
            }
        }
        for ending in endings_group1 {
            if rv.ends_with(ending) {
                let rest = &rv[..rv.len() - ending.len()];
                if rest.ends_with('а') || rest.ends_with('я') {
                    rv.truncate(rv.len() - ending.len());
                    return true;
                }
            }
        }
        false
    }

    fn strip_russian_noun(rv: &mut String) -> bool {
        let endings = [
            "ами", "ями", "ей", "ов", "ев", "ях", "ах", "ам", "ям",
            "ия", "ью", "ие", "ии", "ию", "ья", "ье", "ом", "ем",
            "а", "е", "и", "о", "у", "ы", "ь", "ю", "я"
        ];
        for ending in endings {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                return true;
            }
        }
        false
    }

    fn strip_russian_derivational(rv: &mut String) -> bool {
        for ending in ["ост", "ость"] {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                return true;
            }
        }
        false
    }

    fn strip_russian_superlative(rv: &mut String) -> bool {
        for ending in ["ейш", "ейше"] {
            if rv.ends_with(ending) {
                rv.truncate(rv.len() - ending.len());
                return true;
            }
        }
        false
    }

    // --- English Porter/Snowball Stemmer ---
    fn is_english_vowel(c: char) -> bool {
        matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'y')
    }

    fn stem_english(word: &str) -> String {
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
        } else if s.ends_with("ed") {
            let stem = &s[..s.len() - 2];
            if stem.chars().any(Self::is_english_vowel) {
                s.truncate(s.len() - 2);
                if s.ends_with("at") || s.ends_with("bl") || s.ends_with("iz") {
                    s.push('e');
                }
            }
        } else if s.ends_with("ing") {
            let stem = &s[..s.len() - 3];
            if stem.chars().any(Self::is_english_vowel) {
                s.truncate(s.len() - 3);
                if s.ends_with("at") || s.ends_with("bl") || s.ends_with("iz") {
                    s.push('e');
                }
            }
        }

        // Step 1c: y -> i if vowel in stem
        if s.ends_with('y') {
            let stem = &s[..s.len() - 1];
            if stem.chars().any(Self::is_english_vowel) {
                s.pop();
                s.push('i');
            }
        }

        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_russian_stemming_declensions() {
        // "Лёха", "Лёхе", "Лёху", "Лёхой", "Лёхом"
        let stems: Vec<String> = vec!["Лёха", "Лёхе", "Лёху", "Лёхой", "Лёхом"]
            .into_iter()
            .map(SnowballStemmer::stem_word)
            .collect();
        assert_eq!(stems[0], "лех");
        assert_eq!(stems[1], "лех");
        assert_eq!(stems[2], "лех");
        assert_eq!(stems[3], "лех");
        assert_eq!(stems[4], "лех");
    }

    #[test]
    fn test_russian_words() {
        assert_eq!(SnowballStemmer::stem_word("Замка"), "замк");
        assert_eq!(SnowballStemmer::stem_word("Замком"), "замк");
        assert_eq!(SnowballStemmer::stem_word("Вэйрелу"), "вэйрел");
    }
}

