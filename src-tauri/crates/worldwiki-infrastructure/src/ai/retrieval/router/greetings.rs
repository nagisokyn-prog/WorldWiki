pub(crate) fn is_greeting_or_short(query: &str) -> bool {
    let q = query.trim().to_lowercase();
    if q.chars().count() < 4 {
        return true;
    }

    let greetings = [
        "привет", "здравствуй", "добрый день", "добрый вечер", "доброе утро",
        "хай", "хей", "салют", "ку", "спасибо", "благодарю", "пока", "до свидания",
        "hello", "hi", "hey", "thanks", "thank you", "bye",
    ];

    if greetings
        .iter()
        .any(|&g| q == g || q == format!("{g}!") || q == format!("{g}."))
    {
        return true;
    }

    false
}
