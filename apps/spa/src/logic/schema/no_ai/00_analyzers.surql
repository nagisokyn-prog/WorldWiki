-- ==============================================================================
-- 00_ANALYZERS.SURQL — ПОЛНОТЕКСТОВЫЕ ТОКЕНИЗАТОРЫ И ФИЛЬТРЫ (BASE & ULTRA)
-- ==============================================================================
-- Включает:
-- 1. like: Токенизатор быстрого поиска (blank, class, camel) с ascii и lowercase.
-- 2. ru_en_analyzer: Русско-английский стемминг Snowball для морфологического поиска автора.
-- ==============================================================================

DEFINE ANALYZER OVERWRITE like TOKENIZERS blank, class, camel FILTERS ascii, lowercase;
DEFINE ANALYZER OVERWRITE ru_en_analyzer TOKENIZERS class, blank FILTERS lowercase, snowball(russian), snowball(english);
DEFINE ANALYZER OVERWRITE autocomplete_analyzer TOKENIZERS class, blank FILTERS lowercase, edgengram(2, 10);

-- 3. БАЗОВАЯ НОРМАЛИЗАЦИЯ RECORD ID ПРОЕКТА (0ns Fast-Path)
DEFINE FUNCTION OVERWRITE fn::normalize_project_id($p: any) {
    LET $str = type::string($p);
    LET $clean = string::replace(string::replace(string::replace(string::replace(string::replace($str, 'projects:', ''), '⟨', ''), '⟩', ''), '`', ''), '\\', '');
    RETURN type::record('projects', $clean);
};

