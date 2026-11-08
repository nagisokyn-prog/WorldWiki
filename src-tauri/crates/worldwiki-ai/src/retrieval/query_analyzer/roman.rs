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
