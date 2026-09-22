pub mod english;
pub mod russian;
pub mod vowels;

use english::stem_english;
use russian::stem_russian;

/// Robust, self-contained Cyrillic (Russian) and Latin (English) Snowball stemmer
/// for fuzzy entity matching and search across all grammatical cases and declensions.
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
            stem_russian(&clean)
        } else {
            stem_english(&clean)
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
