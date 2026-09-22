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

/// Parses Russian ordinal numbers from token
pub(crate) fn parse_russian_ordinal(word: &str) -> Option<i64> {
    let lower = word.to_lowercase();
    for &(stem, val) in ORDINAL_STEMS {
        if lower.starts_with(stem) {
            return Some(val);
        }
    }
    None
}
