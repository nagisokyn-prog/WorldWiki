//! Query Analyzer for extracting structured intent, chapter/volume/arc references,
//! Roman/Arabic numerals, and Russian ordinal word numbers from user queries.

#[derive(Debug, Clone, Default)]
pub struct ExtractedIntent {
    pub chapter_num: Option<i64>,
    pub volume_num: Option<i64>,
    pub arc_num: Option<i64>,
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
    if clean.is_empty() || !clean.chars().all(|c| matches!(c, 'I' | 'V' | 'X' | 'L' | 'C' | 'D' | 'M')) {
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

/// Analyzes user input to extract structural references (chapter, volume, arc)
pub fn analyze_user_query(user_query: &str) -> ExtractedIntent {
    let mut intent = ExtractedIntent {
        chapter_num: None,
        volume_num: None,
        arc_num: None,
        is_chitchat: false,
        semantic_query: user_query.trim().to_string(),
    };

    let lower = user_query.to_lowercase();
    let words: Vec<&str> = lower
        .split(|c: char| c.is_whitespace() || c == ',' || c == '.' || c == '?' || c == '!' || c == ':' || c == ';')
        .filter(|s| !s.is_empty())
        .collect();

    // Context tracking for keywords
    for (i, &word) in words.iter().enumerate() {
        let is_chapter_kw = word.starts_with("глав") || word == "chapter" || word == "гл";
        let is_volume_kw = word.starts_with("том") || word == "volume";
        let is_arc_kw = word.starts_with("арк") || word.starts_with("акт") || word == "arc" || word == "act";

        if is_chapter_kw || is_volume_kw || is_arc_kw {
            // Check preceding word (e.g. "первая глава", "3 глава")
            let mut num: Option<i64> = None;
            if i > 0 {
                let prev = words[i - 1];
                num = prev.parse::<i64>().ok()
                    .or_else(|| parse_roman_numeral(prev))
                    .or_else(|| parse_russian_ordinal(prev));
            }

            // Check following word (e.g. "глава 1", "глава первая", "глава IV")
            if num.is_none() && i + 1 < words.len() {
                let next = words[i + 1];
                num = next.parse::<i64>().ok()
                    .or_else(|| parse_roman_numeral(next))
                    .or_else(|| parse_russian_ordinal(next));
            }

            if let Some(n) = num {
                if is_chapter_kw && intent.chapter_num.is_none() {
                    intent.chapter_num = Some(n);
                } else if is_volume_kw && intent.volume_num.is_none() {
                    intent.volume_num = Some(n);
                } else if is_arc_kw && intent.arc_num.is_none() {
                    intent.arc_num = Some(n);
                }
            }
        }
    }

    // Fallback: check standalone ordinal words if keyword was missing but obvious intent
    if intent.chapter_num.is_none() {
        for &word in &words {
            if let Some(n) = parse_russian_ordinal(word) {
                if lower.contains("глав") || lower.contains("прочит") || lower.contains("сюжет") || lower.contains("текст") {
                    intent.chapter_num = Some(n);
                    break;
                }
            }
        }
    }

    // Detect pure chitchat / greetings (do not trigger RAG context on smalltalk)
    let is_lore_query = lower.contains("глав") || lower.contains("персонаж") || lower.contains("геро") 
        || lower.contains("сюжет") || lower.contains("книг") || lower.contains("мир") 
        || lower.contains("событи") || lower.contains("описан") || lower.contains("кто так") 
        || lower.contains("расскажи") || lower.contains("что происход") || lower.contains("почему");

    let is_greeting = lower.contains("привет") || lower.contains("здравствуй") || lower.contains("добрый день")
        || lower.contains("добрый вечер") || lower.contains("доброе утро") || lower.contains("проверка связи")
        || lower.contains("тестовое сообщение") || lower.contains("как дела") || lower.contains("как полет")
        || lower.contains("как полёт") || lower.contains("ты тут") || lower == "тест" || lower == "хай" || lower == "ку";

    if is_greeting && !is_lore_query && intent.chapter_num.is_none() && intent.volume_num.is_none() {
        intent.is_chitchat = true;
    }

    intent
}
