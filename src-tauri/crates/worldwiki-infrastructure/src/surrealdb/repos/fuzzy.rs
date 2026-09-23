//! Fuzzy matching and canonicalization utilities for SurrealDB lore search.

/// Canonicalizes entity/character names for robust multi-variant matching:
/// - lowercases and trims
/// - strips quotes («», "", ''), brackets, punctuation
/// - normalizes 'ё' -> 'е', 'й' -> 'и'
/// - unifies all dash variations ('–', '—', '―') into '-'
/// - collapses multiple spaces
pub fn canonicalize_name(input: &str) -> String {
    let mut s = input.trim().to_lowercase();
    s = s
        .chars()
        .filter(|c| !"'\"«»`()[]{}<>.,!?;:".contains(*c))
        .collect();
    s = s.replace('ё', "е").replace('й', "и");
    s = s.replace(['–', '—', '―'], "-");
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Computes Levenshtein distance between two strings
pub fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let m = a_chars.len();
    let n = b_chars.len();
    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }
    let mut d = vec![vec![0; n + 1]; m + 1];
    for (i, row) in d.iter_mut().enumerate().take(m + 1) {
        if let Some(first) = row.first_mut() {
            *first = i;
        }
    }
    if let Some(first_row) = d.first_mut() {
        for (j, item) in first_row.iter_mut().enumerate().take(n + 1) {
            *item = j;
        }
    }
    for i in 1..=m {
        for j in 1..=n {
            let cost = if a_chars.get(i - 1) == b_chars.get(j - 1) { 0 } else { 1 };
            let prev_i = d.get(i - 1).and_then(|r| r.get(j)).copied().unwrap_or(0);
            let prev_j = d.get(i).and_then(|r| r.get(j - 1)).copied().unwrap_or(0);
            let prev_diag = d.get(i - 1).and_then(|r| r.get(j - 1)).copied().unwrap_or(0);
            if let Some(r) = d.get_mut(i) {
                if let Some(cell) = r.get_mut(j) {
                    *cell = std::cmp::min(
                        std::cmp::min(prev_i + 1, prev_j + 1),
                        prev_diag + cost,
                    );
                }
            }
        }
    }
    d.get(m).and_then(|r| r.get(n)).copied().unwrap_or(0)
}

/// Checks if query fuzzy-matches target name or any aliases:
/// 1. Canonical equality
/// 2. Snowball stemming match (all grammatical declensions)
/// 3. Substring / Root match
/// 4. Levenshtein distance <= 2 (for typos in long names)
pub fn fuzzy_match_name(query: &str, target_name: &str, aliases: &[String]) -> bool {
    let q_canon = canonicalize_name(query);
    if q_canon.is_empty() {
        return false;
    }
    let q_stem = crate::surrealdb::stemmer::SnowballStemmer::stem_phrase(&q_canon);
    let q_tokens: Vec<String> = q_canon
        .split_whitespace()
        .map(crate::surrealdb::stemmer::SnowballStemmer::stem_word)
        .filter(|s| !s.is_empty())
        .collect();

    let check_candidate = |candidate: &str| -> bool {
        let c_canon = canonicalize_name(candidate);
        if c_canon.is_empty() {
            return false;
        }
        if q_canon == c_canon {
            return true;
        }
        let c_stem = crate::surrealdb::stemmer::SnowballStemmer::stem_phrase(&c_canon);
        if !q_stem.is_empty()
            && !c_stem.is_empty()
            && (q_stem == c_stem || q_stem.contains(&c_stem) || c_stem.contains(&q_stem))
        {
            return true;
        }

        let c_tokens: Vec<String> = c_canon
            .split_whitespace()
            .map(crate::surrealdb::stemmer::SnowballStemmer::stem_word)
            .filter(|s| !s.is_empty())
            .collect();
        for q_tok in &q_tokens {
            if c_tokens.contains(q_tok) {
                return true;
            }
        }
        if q_canon.contains(&c_canon) || c_canon.contains(&q_canon) {
            return true;
        }
        let q_root = if q_canon.chars().count() >= 4 {
            q_canon
                .chars()
                .take(q_canon.chars().count().saturating_sub(2))
                .collect::<String>()
        } else {
            q_canon.clone()
        };
        let c_root = if c_canon.chars().count() >= 4 {
            c_canon
                .chars()
                .take(c_canon.chars().count().saturating_sub(2))
                .collect::<String>()
        } else {
            c_canon.clone()
        };
        if c_canon.starts_with(&q_root) || q_canon.starts_with(&c_root) {
            return true;
        }
        if q_canon.chars().count() >= 4
            && c_canon.chars().count() >= 4
            && levenshtein_distance(&q_canon, &c_canon) <= 2
        {
            return true;
        }
        false
    };

    if check_candidate(target_name) {
        return true;
    }
    for alias in aliases {
        if check_candidate(alias) {
            return true;
        }
    }
    false
}
