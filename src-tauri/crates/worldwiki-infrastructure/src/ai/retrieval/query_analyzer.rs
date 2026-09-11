//! Query Analyzer for extracting structured intent, chapter/volume references,
//! Roman/Arabic numerals, and Russian ordinal word numbers from user queries.

#[derive(Debug, Clone, Default)]
pub struct ExtractedIntent {
    pub chapter_num: Option<i64>,
    pub volume_num: Option<i64>,
    pub is_chitchat: bool,
    pub semantic_query: String,
}

/// Russian ordinal word stems mapped to numbers
const ORDINAL_STEMS: &[(&str, i64)] = &[
    ("перв", 1),
    ("втор", 2),
    ("трет", 3),
    ("четверт", 4),
    ("пят", 5),
    ("шест", 6),
    ("седьм", 7),
    ("семой", 7),
    ("восьм", 8),
    ("девят", 9),
    ("десят", 10),
    ("одиннадцат", 11),
    ("двенадцат", 12),
    ("тринадцат", 13),
    ("четырнадцат", 14),
    ("пятнадцат", 15),
    ("шестнадцат", 16),
    ("семнадцат", 17),
    ("восемнадцат", 18),
    ("девятнадцат", 19),
    ("двадцат", 20),
    ("тридцат", 30),
    ("сороков", 40),
    ("пятидесят", 50),
    ("шестидесят", 60),
    ("семидесят", 70),
    ("восьмидесят", 80),
    ("девяност", 90),
    ("сот", 100),
];

/// Parses Roman numerals into integers
pub fn parse_roman_numeral(s: &str) -> Option<i64> {
    let clean = s.trim().to_uppercase();
    if clean.is_empty()
        || !clean
            .chars()
            .all(|c| matches!(c, 'I' | 'V' | 'X' | 'L' | 'C' | 'D' | 'M'))
    {
        return None;
    }

    let mut total = 0i64;
    let mut prev_val = 0i64;

    for c in clean.chars().rev() {
        let val = match c {
            'I' => 1,
            'V' => 5,
            'X' => 10,
            'L' => 50,
            'C' => 100,
            'D' => 500,
            'M' => 1000,
            _ => return None,
        };

        if val < prev_val {
            total -= val;
        } else {
            total += val;
            prev_val = val;
        }
    }

    if total > 0 && total <= 500 {
        Some(total)
    } else {
        None
    }
}

/// Parses Russian ordinal numbers from token
fn parse_russian_ordinal(word: &str) -> Option<i64> {
    let lower = word.to_lowercase();
    for &(stem, val) in ORDINAL_STEMS {
        if lower.starts_with(stem) {
            return Some(val);
        }
    }
    None
}

/// Analyzes user input to extract structural references (chapter, volume)
pub fn analyze_user_query(user_query: &str) -> ExtractedIntent {
    let mut intent = ExtractedIntent {
        chapter_num: None,
        volume_num: None,
        is_chitchat: false,
        semantic_query: user_query.trim().to_string(),
    };

    let lower = user_query.to_lowercase();
    let words: Vec<&str> = lower
        .split(|c: char| {
            c.is_whitespace()
                || c == ','
                || c == '.'
                || c == '?'
                || c == '!'
                || c == ':'
                || c == ';'
        })
        .filter(|s| !s.is_empty())
        .collect();

    // Context tracking for keywords
    for (i, &word) in words.iter().enumerate() {
        let is_chapter_kw = word.starts_with("глав") || word == "chapter" || word == "гл";
        let is_volume_kw = word.starts_with("том") || word == "volume";

        if is_chapter_kw || is_volume_kw {
            // Check preceding word (e.g. "первая глава", "3 глава")
            let mut num: Option<i64> = None;
            if i > 0 {
                let prev = words[i - 1];
                num = prev
                    .parse::<i64>()
                    .ok()
                    .or_else(|| parse_roman_numeral(prev))
                    .or_else(|| parse_russian_ordinal(prev));
            }

            // Check following word (e.g. "глава 1", "глава первая", "глава IV")
            if num.is_none() && i + 1 < words.len() {
                let next = words[i + 1];
                num = next
                    .parse::<i64>()
                    .ok()
                    .or_else(|| parse_roman_numeral(next))
                    .or_else(|| parse_russian_ordinal(next));
            }

            if let Some(n) = num {
                if is_chapter_kw && intent.chapter_num.is_none() {
                    intent.chapter_num = Some(n);
                } else if is_volume_kw && intent.volume_num.is_none() {
                    intent.volume_num = Some(n);
                }
            }
        }
    }

    // Fallback: check standalone ordinal words if keyword was missing but obvious intent
    if intent.chapter_num.is_none() {
        for &word in &words {
            if let Some(n) = parse_russian_ordinal(word) {
                if lower.contains("глав")
                    || lower.contains("прочит")
                    || lower.contains("сюжет")
                    || lower.contains("текст")
                {
                    intent.chapter_num = Some(n);
                    break;
                }
            }
        }
    }

    // Detect pure chitchat / greetings (do not trigger RAG context on smalltalk)
    let is_lore_query = lower.contains("глав")
        || lower.contains("персонаж")
        || lower.contains("геро")
        || lower.contains("сюжет")
        || lower.contains("книг")
        || lower.contains("мир")
        || lower.contains("событи")
        || lower.contains("описан")
        || lower.contains("кто так")
        || lower.contains("расскажи")
        || lower.contains("что происход")
        || lower.contains("почему");

    let is_greeting = lower.contains("привет")
        || lower.contains("здравствуй")
        || lower.contains("добрый день")
        || lower.contains("добрый вечер")
        || lower.contains("доброе утро")
        || lower.contains("проверка связи")
        || lower.contains("тестовое сообщение")
        || lower.contains("как дела")
        || lower.contains("как полет")
        || lower.contains("как полёт")
        || lower.contains("ты тут")
        || lower == "тест"
        || lower == "хай"
        || lower == "ку";

    if is_greeting && !is_lore_query && intent.chapter_num.is_none() && intent.volume_num.is_none()
    {
        intent.is_chitchat = true;
    }

    intent
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- parse_roman_numeral ----------

    #[test]
    fn parses_single_digits() {
        assert_eq!(parse_roman_numeral("I"), Some(1));
        assert_eq!(parse_roman_numeral("v"), Some(5));
        assert_eq!(parse_roman_numeral("X"), Some(10));
    }

    #[test]
    fn parses_compound_roman() {
        assert_eq!(parse_roman_numeral("IV"), Some(4));
        assert_eq!(parse_roman_numeral("ix"), Some(9));
        assert_eq!(parse_roman_numeral("XIV"), Some(14));
        assert_eq!(parse_roman_numeral("xix"), Some(19));
        assert_eq!(parse_roman_numeral("XXIV"), Some(24));
        assert_eq!(parse_roman_numeral("XLII"), Some(42));
    }

    #[test]
    fn rejects_invalid_roman() {
        assert_eq!(parse_roman_numeral(""), None);
        assert_eq!(parse_roman_numeral("ABC"), None);
        assert_eq!(parse_roman_numeral("123"), None);
        assert_eq!(parse_roman_numeral("глава"), None);
    }

    // ---------- parse_russian_ordinal ----------

    #[test]
    fn parses_basic_ordinals() {
        assert_eq!(parse_russian_ordinal("первая"), Some(1));
        assert_eq!(parse_russian_ordinal("первой"), Some(1));
        assert_eq!(parse_russian_ordinal("первом"), Some(1));
        assert_eq!(parse_russian_ordinal("второй"), Some(2));
        assert_eq!(parse_russian_ordinal("третья"), Some(3));
        assert_eq!(parse_russian_ordinal("третьем"), Some(3));
        assert_eq!(parse_russian_ordinal("четвертая"), Some(4));
        assert_eq!(parse_russian_ordinal("четвертый"), Some(4));
        assert_eq!(parse_russian_ordinal("пятая"), Some(5));
        assert_eq!(parse_russian_ordinal("десятая"), Some(10));
    }

    #[test]
    fn parses_teens_and_tens() {
        assert_eq!(parse_russian_ordinal("одиннадцатая"), Some(11));
        assert_eq!(parse_russian_ordinal("двенадцатая"), Some(12));
        assert_eq!(parse_russian_ordinal("двадцатая"), Some(20));
        assert_eq!(parse_russian_ordinal("тридцатая"), Some(30));
        assert_eq!(parse_russian_ordinal("сотая"), Some(100));
    }

    #[test]
    fn ignores_non_ordinals() {
        assert_eq!(parse_russian_ordinal("глава"), None);
        assert_eq!(parse_russian_ordinal("том"), None);
        assert_eq!(parse_russian_ordinal("привет"), None);
        assert_eq!(parse_russian_ordinal("123"), None);
    }

    #[test]
    fn handles_case_insensitivity() {
        assert_eq!(parse_russian_ordinal("ПЕРВАЯ"), Some(1));
        assert_eq!(parse_russian_ordinal("Второй"), Some(2));
    }

    #[test]
    fn extracts_chapter_and_volume_ordinals() {
        let i1 = analyze_user_query("глава третья");
        assert_eq!(i1.chapter_num, Some(3));
        let i2 = analyze_user_query("том второй");
        assert_eq!(i2.volume_num, Some(2));
    }

    #[test]
    fn extracts_chapter_arabic_after_keyword() {
        let intent = analyze_user_query("расскажи про главу 3");
        assert_eq!(intent.chapter_num, Some(3));
        assert!(!intent.is_chitchat);
    }

    #[test]
    fn extracts_chapter_roman_after_keyword() {
        let intent = analyze_user_query("что происходит в главе IV?");
        assert_eq!(intent.chapter_num, Some(4));
    }

    #[test]
    fn extracts_volume() {
        let v = analyze_user_query("события тома 2 очень важны");
        assert_eq!(v.volume_num, Some(2));
        assert_eq!(v.chapter_num, None);
    }

    #[test]
    fn first_reference_wins_when_duplicated() {
        let intent = analyze_user_query("глава 5 и потом глава 7");
        assert_eq!(
            intent.chapter_num,
            Some(5),
            "берётся первая найденная глава"
        );
    }

    #[test]
    fn chitchat_greeting_detected() {
        for q in ["привет", "как дела?", "добрый день", "ты тут?", "хай"]
        {
            let intent = analyze_user_query(q);
            assert!(intent.is_chitchat, "ожидается chitchat: {q}");
        }
    }

    #[test]
    fn lore_question_is_not_chitchat_even_with_greeting_word() {
        let intent = analyze_user_query("привет! расскажи о мире этого романа");
        assert!(
            !intent.is_chitchat,
            "вопрос про лор не должен считаться болтовнёй"
        );
        assert_eq!(intent.chapter_num, None);
    }

    #[test]
    fn chapter_question_with_ordinal_fallback_without_direct_number() {
        let intent = analyze_user_query("какая глава первая по сюжету?");
        assert_eq!(intent.chapter_num, Some(1));
    }

    #[test]
    fn semantic_query_preserves_trimmed_input() {
        let intent = analyze_user_query("  кто такой Артур?  ");
        assert_eq!(intent.semantic_query, "кто такой Артур?");
        assert!(!intent.is_chitchat);
    }

    #[test]
    fn default_intent_for_plain_lore_question() {
        let intent = analyze_user_query("кто такой Артур?");
        assert_eq!(intent.chapter_num, None);
        assert_eq!(intent.volume_num, None);
        assert!(!intent.is_chitchat);
    }
}
