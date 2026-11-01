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
/// При конфликтах транзакций (OCC write conflict) автоматически повторяет запрос до 5 раз.
#[macro_export]
macro_rules! surreal_exec {
    ($db:expr, $sql:expr $(, ($k:expr, $v:expr))* $(,)?) => {{
        let mut attempts: u64 = 0;
        loop {
            attempts += 1;
            let mut req = $db.query($sql);
            $(
                req = req.bind(($k, ($v).clone()));
            )*
            let res = match req.await {
                Ok(r) => r,
                Err(e) => {
                    let err_msg = e.to_string();
                    if (err_msg.contains("Transaction conflict") || err_msg.contains("write conflict")) && attempts < 5 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 25)).await;
                        continue;
                    }
                    return Err(worldwiki_domain::errors::DomainError::ConstraintViolation(err_msg));
                }
            };
            match res.check() {
                Ok(_) => break Ok::<(), worldwiki_domain::errors::DomainError>(()),
                Err(e) => {
                    let err_msg = e.to_string();
                    if (err_msg.contains("Transaction conflict") || err_msg.contains("write conflict")) && attempts < 5 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 25)).await;
                        continue;
                    }
                    return Err(worldwiki_domain::errors::DomainError::ConstraintViolation(err_msg));
                }
            }
        }
    }};
}

/// Выполняет запрос к SurrealDB и извлекает первый элемент как Option<T>.
/// При конфликтах транзакций (OCC write conflict) автоматически повторяет запрос до 5 раз.
#[macro_export]
macro_rules! surreal_take_one {
    ($db:expr, $sql:expr $(, ($k:expr, $v:expr))* $(,)?) => {{
        let mut attempts: u64 = 0;
        loop {
            attempts += 1;
            let mut req = $db.query($sql);
            $(
                req = req.bind(($k, ($v).clone()));
            )*
            let res = match req.await {
                Ok(r) => r,
                Err(e) => {
                    let err_msg = e.to_string();
                    if (err_msg.contains("Transaction conflict") || err_msg.contains("write conflict")) && attempts < 5 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 25)).await;
                        continue;
                    }
                    return Err(worldwiki_domain::errors::DomainError::ConstraintViolation(err_msg));
                }
            };
            match res.check() {
                Ok(mut checked) => break $crate::surrealdb::repos::helpers::take_one(&mut checked, 0),
                Err(e) => {
                    let err_msg = e.to_string();
                    if (err_msg.contains("Transaction conflict") || err_msg.contains("write conflict")) && attempts < 5 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 25)).await;
                        continue;
                    }
                    return Err(worldwiki_domain::errors::DomainError::ConstraintViolation(err_msg));
                }
            }
        }
    }};
}

/// Выполняет запрос к SurrealDB и извлекает массив элементов как Vec<T>.
/// При конфликтах транзакций (OCC write conflict) автоматически повторяет запрос до 5 раз.
#[macro_export]
macro_rules! surreal_take_list {
    ($db:expr, $sql:expr $(, ($k:expr, $v:expr))* $(,)?) => {{
        let mut attempts: u64 = 0;
        loop {
            attempts += 1;
            let mut req = $db.query($sql);
            $(
                req = req.bind(($k, ($v).clone()));
            )*
            let res = match req.await {
                Ok(r) => r,
                Err(e) => {
                    let err_msg = e.to_string();
                    if (err_msg.contains("Transaction conflict") || err_msg.contains("write conflict")) && attempts < 5 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 25)).await;
                        continue;
                    }
                    return Err(worldwiki_domain::errors::DomainError::ConstraintViolation(err_msg));
                }
            };
            match res.check() {
                Ok(mut checked) => break $crate::surrealdb::repos::helpers::take_list(&mut checked, 0),
                Err(e) => {
                    let err_msg = e.to_string();
                    if (err_msg.contains("Transaction conflict") || err_msg.contains("write conflict")) && attempts < 5 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 25)).await;
                        continue;
                    }
                    return Err(worldwiki_domain::errors::DomainError::ConstraintViolation(err_msg));
                }
            }
        }
    }};
}

