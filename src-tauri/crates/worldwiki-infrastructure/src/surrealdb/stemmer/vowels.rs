pub(crate) fn is_russian_vowel(c: char) -> bool {
    matches!(c, 'а' | 'е' | 'и' | 'о' | 'у' | 'ы' | 'э' | 'ю' | 'я')
}

pub(crate) fn is_english_vowel(c: char) -> bool {
    matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'y')
}
