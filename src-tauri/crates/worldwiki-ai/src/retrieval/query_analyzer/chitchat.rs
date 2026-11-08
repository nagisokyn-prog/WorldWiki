pub(crate) fn is_chitchat_query(lower: &str) -> bool {
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

    is_greeting && !is_lore_query
}
