use super::vowels::is_russian_vowel;

pub(crate) fn stem_russian(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    if chars.len() <= 3 {
        return word.to_string();
    }

    // Find RV region (region after first vowel)
    let rv_pos = match chars.iter().position(|&c| is_russian_vowel(c)) {
        Some(pos) => pos + 1,
        None => return word.to_string(),
    };

    if rv_pos >= chars.len() {
        return word.to_string();
    }

    let mut rv: String = chars[rv_pos..].iter().collect();
    let prefix: String = chars[..rv_pos].iter().collect();

    // Step 1: Remove perfective gerund, adjective, participle, reflexive, verb, or noun endings
    if !strip_russian_perfective_gerund(&mut rv) {
        strip_russian_reflexive(&mut rv);
        if !strip_russian_adjective(&mut rv) && !strip_russian_verb(&mut rv) {
            strip_russian_noun(&mut rv);
        }
    }

    // Step 2: Remove 'и' ending
    if rv.ends_with('и') {
        rv.pop();
    }

    // Step 3: Remove derivational endings
    strip_russian_derivational(&mut rv);

    // Step 4: Undouble 'нн' -> 'н', remove superlative or soft sign
    if rv.ends_with("нн") {
        rv.pop();
    }
    strip_russian_superlative(&mut rv);
    if rv.ends_with('ь') {
        rv.pop();
    }

    format!("{prefix}{rv}")
}

fn strip_russian_perfective_gerund(rv: &mut String) -> bool {
    let endings_group1 = ["в", "вши", "вшись"];
    let endings_group2 = ["ив", "ивши", "ившись", "ыв", "ывши", "ывшись"];

    for ending in endings_group2 {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            return true;
        }
    }
    for ending in endings_group1 {
        if let Some(stripped) = rv.strip_suffix(ending) {
            if stripped.ends_with('а') || stripped.ends_with('я') {
                *rv = stripped.to_string();
                return true;
            }
        }
    }
    false
}

fn strip_russian_reflexive(rv: &mut String) -> bool {
    for ending in ["ся", "сь"] {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            return true;
        }
    }
    false
}

fn strip_russian_adjective(rv: &mut String) -> bool {
    let endings = [
        "ее", "ие", "ые", "ое", "ими", "ыми", "ей", "ий", "ый", "ой",
        "ем", "им", "ым", "ом", "его", "ого", "ему", "ому", "их", "ых",
        "ую", "юю", "ая", "яя", "ою", "ею",
    ];
    for ending in endings {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            strip_russian_participle(rv);
            return true;
        }
    }
    false
}

fn strip_russian_participle(rv: &mut String) -> bool {
    let endings_group1 = ["ем", "нн", "вш", "ющ", "щ"];
    let endings_group2 = ["ивш", "ывш", "ующ"];

    for ending in endings_group2 {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            return true;
        }
    }
    for ending in endings_group1 {
        if let Some(stripped) = rv.strip_suffix(ending) {
            if stripped.ends_with('а') || stripped.ends_with('я') {
                *rv = stripped.to_string();
                return true;
            }
        }
    }
    false
}

fn strip_russian_verb(rv: &mut String) -> bool {
    let endings_group1 = [
        "ла", "на", "ете", "йте", "ли", "й", "л", "ем", "н", "ло", "но", "ет", "ют", "ны", "ть",
        "ешь", "нно",
    ];
    let endings_group2 = [
        "ила", "ыла", "ена", "ейте", "уйте", "ите", "или", "ыли", "ей", "уй", "ил", "ыл",
        "им", "ым", "ен", "ило", "ыло", "ено", "ят", "ует", "уют", "ит", "ыт", "ены", "ить",
        "ыть", "ишь", "ей", "ейте",
    ];

    for ending in endings_group2 {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            return true;
        }
    }
    for ending in endings_group1 {
        if let Some(stripped) = rv.strip_suffix(ending) {
            if stripped.ends_with('а') || stripped.ends_with('я') {
                *rv = stripped.to_string();
                return true;
            }
        }
    }
    false
}

fn strip_russian_noun(rv: &mut String) -> bool {
    let endings = [
        "ами", "ями", "ей", "ов", "ев", "ях", "ах", "ам", "ям", "ия", "ью", "ие", "ии", "ию",
        "ья", "ье", "ом", "ем", "а", "е", "и", "о", "у", "ы", "ь", "ю", "я",
    ];
    for ending in endings {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            return true;
        }
    }
    false
}

fn strip_russian_derivational(rv: &mut String) -> bool {
    for ending in ["ост", "ость"] {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            return true;
        }
    }
    false
}

fn strip_russian_superlative(rv: &mut String) -> bool {
    for ending in ["ейш", "ейше"] {
        if let Some(stripped) = rv.strip_suffix(ending) {
            *rv = stripped.to_string();
            return true;
        }
    }
    false
}
