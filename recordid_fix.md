# Хроника фикса `save_chapter` + решение текущей ошибки `RecordId`

## Что было в истории (из `Fixing SurrealDB Project ID Mismatch.md`)

### Эволюция ошибки (8 стадий)

| Стадия | Ошибка | Причина | Артефакт |
|--------|--------|---------|----------|
| 1 | `Expected record<projects> but found 'projects:\`123\`'` | JS-бэктики в `projectRecordId` | `project_id_desync_analysis.md` |
| 2 | `Expected record<projects> but found 'projects:абв'` | `.content(json)` передаёт строку, а не RecordId | — |
| 3 | `Could not cast into record using input NONE` | Двухшаговый upsert: шаг 1 без `project_id` падает, до шаг 2 не доходит | `record_ref_fix_spec.md` |
| 4 | `Parse error: Invalid function path type::thing(...)` | В SurrealDB 3 нет `type::thing()`, есть только `type::record()` | — |
| 5 | `Parse error: did you maybe mean type::record` | Ошибка строковой вставки SQL-функции в запрос | — |
| 6 | `Record not found after upsert` | `.take(0).unwrap_or_default()` глотал реальную ошибку | — |
| 7 | `Expected none\|string but found NULL` | JS `null` → `serde_json::Null` → SurrealDB `NULL ≠ NONE` | `save_chapter_bug_analysis.md` |
| **8** | **✅ РАБОТАЕТ** | `.retain(|_, v| !v.is_null())` + нативный `RecordId::new()` | — |

### Ключевые выводы (запомнить навсегда)

1. **`.content(json_val)` фундаментально сломан** для полей `TYPE record<X>`. JSON не знает типа «record» — только строки/объекты/числа. Сколько бы ты ни форматировал строку, SurrealDB 3.2.1 её не примет через `.content()`.

2. **`VALUE <record> $value` в схеме ломает нативный RecordId**. Когда правильный нативный `RecordId` попадал в базу, схемный каст ещё раз кастил его — и получался `NONE`. Решение: убрать `VALUE <record> $value` из всех `DEFINE FIELD`.

3. **Правильный путь**: `UPSERT $__record_id SET field = $val` где `$__record_id` биндится как `surrealdb::types::RecordId::new(tb, id)`.

4. **`NULL ≠ NONE`**: JS `null` → `serde_json::Value::Null` → SurrealDB `NULL`. Но `option<string>` ждёт `NONE`. Фикс: `.retain(|_, v| !v.is_null())` перед биндингом.

---

## Текущая ошибка компиляции

```
error[E0308]: mismatched types
--> lib.rs:175
    surrealdb::types::RecordId::from((tb, actual_id))
    expected `RecordId`, found `(&str, &str)`
```

### Причина

`surrealdb::types::RecordId` в версии 3.2.1 **не реализует `From<(&str, &str)>`**. Метод `.from((table, id))` не существует ни для `&str`, ни для `String`.

### Правильный конструктор (из истории, строка 981 в md)

```rust
// ❌ НЕПРАВИЛЬНО — From<(T, T)> не реализован:
surrealdb::types::RecordId::from((tb, actual_id))
surrealdb::types::RecordId::from(("projects".to_string(), "абв".to_string()))

// ✅ ПРАВИЛЬНО — используй new():
surrealdb::types::RecordId::new(tb, actual_id)
//   где tb: &'static str (или impl Into<Arc<str>>)
//        actual_id: impl Into<Id>
```

Именно `RecordId::new(tb, raw)` был найден в истории (строка ~1173): *"Наш код `surreal_domain_core` собрался с `RecordId::new`"*.

---

## Что нужно изменить в `lib.rs`

### Строка 175
```rust
// ❌ Сейчас:
let mut db_query = db.query(query).bind(("__record_id", surrealdb::types::RecordId::from((tb, actual_id))));

// ✅ Исправить на:
let mut db_query = db.query(query).bind(("__record_id", surrealdb::types::RecordId::new(tb, actual_id)));
```

### Строка 183
```rust
// ❌ Сейчас:
db_query = db_query.bind((k.as_str(), surrealdb::types::RecordId::from((parts[0], parts[1]))));

// ✅ Исправить на:
db_query = db_query.bind((k.as_str(), surrealdb::types::RecordId::new(parts[0], parts[1])));
```

> [!IMPORTANT]
> `RecordId::new(table, id)` — это стабильный конструктор в `surrealdb-types 3.2.1`. Он принимает `impl Into<Arc<str>>` для таблицы и `impl Into<Id>` для идентификатора. `&str` автоматически подходит для обоих.

> [!WARNING]
> После этого фикса сборка должна пройти. Но если `save_chapter` вернёт ошибку `Could not cast into record using input NONE` — это означает, что в схеме `surreal_schema.surql` ещё остался `VALUE <record> $value`. Его нужно убрать из определений `project_id`, `arc_id`, `volume_id` на всех таблицах.
