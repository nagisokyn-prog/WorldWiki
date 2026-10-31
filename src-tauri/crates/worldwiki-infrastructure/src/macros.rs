//! Infrastructure-level declarative macros for SurrealDB operations and ID normalization.

/// Zero-allocation макрос для нормализации сырого Record ID SurrealDB:
/// - Удаляет префикс таблицы (если передан как строковый литерал, переменная или константа)
/// - Срезает экранирующие символы SurrealDB (` ``, `⟨`, `⟩`, `"`, `'`)
#[macro_export]
macro_rules! clean_raw_id {
    ($raw:expr) => {{
        let s: &str = $raw;
        let trimmed = s.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');
        match trimmed.split_once(':') {
            Some((_tbl, id)) => id.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\''),
            None => trimmed,
        }
    }};
    ($raw:expr, $table:expr) => {{
        let s: &str = $raw;
        let tbl: &str = $table;
        let trimmed = s.trim();
        let stripped = if let Some(rest) = trimmed.strip_prefix(tbl) {
            rest.strip_prefix(':').unwrap_or(rest)
        } else {
            trimmed
        };
        stripped.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'')
    }};
}

/// Выполняет мутирующий запрос к SurrealDB (INSERT / UPDATE / DELETE / fn::*).
/// Проверяет ошибки базы через .check() и возвращает Result<(), DomainError>.
#[macro_export]
macro_rules! surreal_exec {
    ($db:expr, $sql:expr $(, ($k:expr, $v:expr))* $(,)?) => {{
        let mut req = $db.query($sql);
        $(
            req = req.bind(($k, $v));
        )*
        let res = req
            .await
            .map_err(|e| worldwiki_domain::errors::DomainError::ConstraintViolation(e.to_string()))?;
        res.check()
            .map_err(|e| worldwiki_domain::errors::DomainError::ConstraintViolation(e.to_string()))?;
        Ok::<(), worldwiki_domain::errors::DomainError>(())
    }};
}

/// Выполняет запрос к SurrealDB и извлекает первый элемент как Option<T>.
#[macro_export]
macro_rules! surreal_take_one {
    ($db:expr, $sql:expr $(, ($k:expr, $v:expr))* $(,)?) => {{
        let mut req = $db.query($sql);
        $(
            req = req.bind(($k, $v));
        )*
        let res = req
            .await
            .map_err(|e| worldwiki_domain::errors::DomainError::ConstraintViolation(e.to_string()))?;
        let mut checked = res
            .check()
            .map_err(|e| worldwiki_domain::errors::DomainError::ConstraintViolation(e.to_string()))?;
        $crate::surrealdb::repos::helpers::take_one(&mut checked, 0)
    }};
}

/// Выполняет запрос к SurrealDB и извлекает массив элементов как Vec<T>.
#[macro_export]
macro_rules! surreal_take_list {
    ($db:expr, $sql:expr $(, ($k:expr, $v:expr))* $(,)?) => {{
        let mut req = $db.query($sql);
        $(
            req = req.bind(($k, $v));
        )*
        let res = req
            .await
            .map_err(|e| worldwiki_domain::errors::DomainError::ConstraintViolation(e.to_string()))?;
        let mut checked = res
            .check()
            .map_err(|e| worldwiki_domain::errors::DomainError::ConstraintViolation(e.to_string()))?;
        $crate::surrealdb::repos::helpers::take_list(&mut checked, 0)
    }};
}

