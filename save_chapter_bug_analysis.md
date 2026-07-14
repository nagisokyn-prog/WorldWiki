# Анализ: Ошибка `project_id` при сохранении глав

## Суть ошибки

```
Expected `record<projects>` but found `'projects:`123`'`
```

SurrealDB получает значение поля `project_id` в виде строки `'projects:⟨123⟩'` (то есть **строку, содержащую запись**), а не **саму запись** (`record<projects>`). Это фундаментальная проблема несоответствия типов.

---

## Полная цепочка воспроизведения

### 1. Фронтенд → `api.service.ts` (строка 151, 379)

```ts
const projectRecordId = (p: string) =>
    (p.startsWith("projects:") ? p : `projects:\`${p}\``);

// В saveChapter:
project_id: projectRecordId(project),
// Результат: "projects:`123`"
```

Фронтенд формирует строку `projects:\`123\`` (с бэктиками через шаблон JS) и отправляет её как JSON-поле `project_id`.

### 2. Данные прилетают в макрос `surreal_entity!` → `save_chapter`

Сгенерированная командой `save_chapter` (`entity.rs`, строки 203–244) принимает `data: serde_json::Value` и перед сохранением вызывает:

```rust
let resolved = surreal_domain::resolve_record_id(db, val).await;
obj.insert(key.to_string(), resolved);
```

### 3. `resolve_record_id` (lib.rs, строки 216–250) — **здесь баг**

Функция пытается найти запись в БД по строке `"projects:\`123\`"`.
Она разбивает по первому `:` и получает:
- `tb = "projects"`
- `raw = "\`123\`"` ← именно так: с бэктиками

Затем выполняет:
```sql
SELECT id FROM projects WHERE id = type::record($tb, $raw)
   OR id = type::thing($tb, $raw) LIMIT 1
```

Запись реально существует в БД с ID `projects:⟨123⟩` (или `projects:123`). Но запрос ищет `type::record('projects', '\`123\`')` — **с бэктиками в качестве содержимого**, а не как escape-синтаксис SurrealDB. Поэтому совпадения нет.

### 4. `resolve_record_id` возвращает оригинальное значение

Раз запись не найдена — функция возвращает оригинальный JSON (`"projects:\`123\`"`).

### 5. `save()` / `.content()` → SurrealDB отклоняет

`save()` вызывает `db.upsert((TABLE, id)).content(val)`. SurrealDB видит строку `'projects:\`123\`'` в поле, которое DEFINE FIELD ожидает `record<projects>` — и выбрасывает ошибку coerce.

---

## Корневые причины (их две)

### Причина A: Неправильный формат `project_id` на фронтенде

**Файл:** [`api.service.ts` L151](file:///c:/Users/Kuzma/Desktop/WorldWiki/src/ts/services/api.service.ts#L151)

```ts
// Текущий код — генерирует строку с JavaScript-бэктиками:
const projectRecordId = (p) => `projects:\`${p}\``;
// Отправляет: "projects:`123`"
```

JavaScript бэктик (`` ` ``) — это **не** escape-синтаксис SurrealDB. Это просто буква в строке. SurrealDB не понимает `'projects:\`123\`'` как record ID.

Правильный формат для передачи в SurrealDB через `type::record()` — просто голое название: `"123"` (таблица передаётся отдельно), или строка `"projects:123"` (без каких-либо кавычек/бэктиков).

> [!CAUTION]
> Бэктики (`⟨⟩`) нужны только **в сыром SurrealQL-запросе** при передаче ID прямо в текст запроса, чтобы экранировать спецсимволы. Когда ID передаётся через `$binding` (переменную), никакого экранирования не нужно — драйвер делает это сам.

### Причина B: `resolve_record_id` не умеет работать с escaped-строками

**Файл:** [`surreal_domain_core/src/lib.rs` L216–250](file:///c:/Users/Kuzma/Desktop/WorldWiki/tauri-surreal-kit/backend/surreal_domain/surreal_domain_core/src/lib.rs#L216)

```rust
let parts: Vec<&str> = s.splitn(2, ':').collect();
// Для "projects:`123`":  tb="projects", raw="`123`"
// Поиск по type::record('projects', '`123`') — никогда не найдёт
```

Функция не зачищает бэктики/`⟨⟩` из `raw` перед построением запроса. Даже если бы фронтенд слал такой формат намеренно, `resolve_record_id` всё равно не справился бы.

---

## Диаграмма потока данных

```
Frontend:  "123" (project name)
    ↓ projectRecordId()
    "projects:`123`"   ← строка с JS-бэктиками
    ↓ invoke("save_chapter", {data: {..., project_id: "projects:`123`"}})

Backend macro save_chapter:
    ↓ resolve_record_id(db, "projects:`123`")
        splitn(':') → tb="projects", raw="`123`"
        SELECT ... WHERE id = type::record('projects', '`123`')  → NOT FOUND
        ← returns "projects:`123`" unchanged
    ↓ upsert.content({project_id: "projects:`123`"})

SurrealDB:
    DEFINE FIELD project_id TYPE record<projects>
    received: String("projects:`123`")
    ← Error: Expected record<projects>, found 'projects:`123`'
```

---

## Что нужно исправить

### Исправление 1 (фронтенд, приоритет: ВЫСОКИЙ)

**Файл:** [`api.service.ts` L151](file:///c:/Users/Kuzma/Desktop/WorldWiki/src/ts/services/api.service.ts#L151)

`projectRecordId` должен возвращать строку без бэктиков. Бэктики — это синтаксис SurrealQL-запроса, а не формат ID для Rust-драйвера.

```ts
// Было:
const projectRecordId = (p) => (p.startsWith("projects:") ? p : `projects:\`${p}\``);

// Должно быть:
const projectRecordId = (p) => (p.startsWith("projects:") ? p : `projects:${p}`);
```

Rust-драйвер surrealdb передаёт значения через байндинги (`$var`), при этом он автоматически применяет нужный тип. Строка `"projects:123"` при попадании в поле `TYPE record<projects>` через `.content()` будет правильно преобразована в запись.

### Исправление 2 (backend/kit, приоритет: СРЕДНИЙ)

**Файл:** [`surreal_domain_core/src/lib.rs` L219](file:///c:/Users/Kuzma/Desktop/WorldWiki/tauri-surreal-kit/backend/surreal_domain/surreal_domain_core/src/lib.rs#L216)

Перед использованием `raw` в запросе нужно зачистить escape-символы SurrealDB:

```rust
// Добавить перед построением запроса:
let raw = raw.trim_matches(|c| c == '`' || c == '⟨' || c == '⟩');
```

Это сделает функцию устойчивой к любому формату входящей строки.

---

## Дополнительный контекст

- В `volumes.rs` все запросы используют `type::record('projects', $proj_name)` с чистым именем — **это правильно**.
- Проблема касается **только** того пути, где `project_id` формируется на фронтенде и затем проходит через генерируемый макросом `save_chapter`. Вручную написанные команды (`create_volume`, `create_arc` и т.д.) этой проблемы не имеют.
- После исправления 1 проблема уйдёт полностью. Исправление 2 — превентивное, на случай попадания скрипченных строк из других источников.
