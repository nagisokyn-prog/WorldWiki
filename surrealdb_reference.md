# 🧠 SurrealDB — Справочник для агента разработки

> **Актуальность:** май 2026 | **Последняя версия:** SurrealDB 3.x
> **Официальная документация:** https://surrealdb.com/docs

---

## 1. Что такое SurrealDB

**SurrealDB** — мульти-модельная база данных на Rust, объединяющая в одном движке:
- Документную модель (как MongoDB)
- Графовую модель (как Neo4j)
- Реляционную модель (как PostgreSQL)
- Key-value
- Time-series
- Геопространственные данные
- Векторный поиск (для AI/RAG)

### Ключевые особенности
- **Единый бинарник** — можно встроить в приложение, запустить в браузере (WASM), на edge или в кластере
- **SurrealQL** — SQL-подобный язык с поддержкой графов, вложенных объектов, Record IDs
- **Встроенная авторизация** — RBAC, record-level permissions, JWT
- **Realtime** — live queries, changefeeds
- **ACID транзакции** — multi-row, multi-table
- **GraphQL endpoint** — стабильный с 3.0 (`/graphql`)
- **Встроенные API endpoints** — `DEFINE API` (с 3.0)
- **AI-нативность** — vector search, embeddings, file support, Surrealism (WASM-расширения)

---

## 2. Быстрый старт

### Установка

```bash
# macOS
brew install surrealdb/tap/surreal

# Linux / Unix
curl -sSf https://install.surrealdb.com | sh

# Windows
iwr https://install.surrealdb.com -useb | iex

# Docker
docker run --rm -p 8000:8000 surrealdb/surrealdb:latest start
```

### Запуск сервера

```bash
# In-memory (для разработки)
surreal start --user root --pass root memory

# С файлом
surreal start --user root --pass root file:///path/to/db.db

# С кастомным портом
surreal start --bind 127.0.0.1:8080 --user root --pass root memory

# С запретом произвольных запросов для гостей (для API-only режима)
surreal start --user root --pass root --deny-arbitrary-query guest memory
```

### Docker

```bash
# Базовый запуск
docker run --rm --pull always -p 8000:8000 surrealdb/surrealdb:latest start --log info --user root --pass root memory

# С volume для персистентности
docker run --rm -p 8000:8000 -v mydata:/data surrealdb/surrealdb:latest start --user root --pass root file:/data/mydatabase.db
```

### Surrealist (GUI)

```bash
docker run -d -p 8080:8080 surrealdb/surrealist:latest
```

---

## 3. Основные концепции

### 3.1 Record IDs

Record ID — первоклассный гражданин в SurrealDB. Формат: `table:id`

```sql
-- Создание с рандомным ID (по умолчанию 20 символов)
CREATE person SET name = "John";
-- → person:ezs644u19mae2p68404j

-- С явным ID
CREATE person:john SET name = "John";

-- ID-генераторы
CREATE temperature:rand() SET celsius = 37.5;
CREATE temperature:ulid() SET celsius = 37.5;   -- временно-сортируемый
CREATE temperature:uuid() SET celsius = 37.5;    -- UUIDv7

-- Числовые ID
CREATE article:10 SET title = "Hello";

-- Сложные ID (с пробелами/спецсимволами)
CREATE article:`8424486b-85b3-4448-ac8d-5d51083391c7` SET title = "X";

-- Array/Object ID
CREATE weather:['Seoul', time::now()] SET temp = 25;

-- Использование параметров
LET $now = time::now();
CREATE type::record("weather", $now) SET temp = 25;
```

**Важно:** Record IDs **иммутабельны**. Если нужно изменить ID — создайте новую запись и удалите старую.

### 3.2 Типы данных

| Тип | Пример | Описание |
|-----|--------|----------|
| `string` | `"hello"` | Строка |
| `int` | `42` | 64-bit integer |
| `float` | `3.14f` | 64-bit float |
| `decimal` | `0.3dec` | Точные десятичные |
| `bool` | `true` | Булев |
| `datetime` | `d'2025-01-01T00:00:00Z'` | Дата/время |
| `duration` | `1w2d3h` | Продолжительность |
| `bytes` | `<bytes>[83, 117, 114]` | Байты |
| `none` | `NONE` | Отсутствие значения |
| `null` | `NULL` | Null |
| `array` | `[1, 2, 3]` | Массив |
| `object` | `{ a: 1, b: 2 }` | Объект |
| `record` | `person:john` | Ссылка на запись |
| `geometry` | — | Геометрические типы |
| `uuid` | `u'...'` | UUID |

**Приведение типов:**
```sql
UPDATE person SET
    waist = <int> "34.59",
    height = <float> 201,
    score = <decimal> 0.3 + 0.3 + 0.3 + 0.1;
```

### 3.3 Три способа моделирования связей

#### A. Record Links (простые ссылки)
```sql
-- Однонаправленная ссылка
DEFINE FIELD owner ON license TYPE record<person>;
CREATE license SET owner = person:john;

-- Доступ через точку
SELECT owner.name FROM license;
SELECT owner.friends.name FROM person:john;  -- вложенные
```

#### B. Record References (двунаправленные, с 3.0)
```sql
-- Добавляем REFERENCE — и обратная сторона видит связь автоматически
DEFINE FIELD owner ON license TYPE record<person> REFERENCE;
DEFINE FIELD licenses ON person COMPUTED <~license;

-- Теперь при запросе person автоматически подтянутся license
SELECT name, licenses.{ since, type } FROM person;

-- Или inline в запросе
SELECT name, (SELECT type FROM <~license ORDER BY since) AS driving_licenses FROM person;
```

#### C. Graph Edges (графовые рёбра)
```sql
-- Создание связи с метаданными
RELATE person:alex->follows->person:tobie
    SET followed_at = time::now(), strength = "high";

-- Траверсал (обход графа)
SELECT ->follows->person.name FROM person:alex;        -- когоfollows Alex
SELECT <-follows<-person.name FROM person:tobie;       -- кто follows Tobie
SELECT ->follows->follows->person.name FROM person:alex;  -- друзья друзей

-- Двунаправленные
RELATE person:a<->friends_with<->person:b SET since = d'2020-01-01';

-- Schema-defined edge
DEFINE TABLE likes TYPE RELATION IN person OUT blog_post;
```

**Когда что использовать:**
- **Record Links** — простые, прямые связи, максимальная производительность
- **Record References** — нужна двунаправленность, но без метаданных на связи
- **Graph Edges** — сложные связи с метаданными, визуализация, многошаговые обходы

---

## 4. SurrealQL — язык запросов

### 4.1 CRUD операции

```sql
-- CREATE
CREATE person SET name = "John", age = 30;
CREATE person:john CONTENT { name: "John", age: 30 };
CREATE person CONTENT { name: "Jane", tags: ["dev", "rust"] };

-- READ
SELECT * FROM person;
SELECT name, age FROM person WHERE age >= 18;
SELECT name, metadata.{ date_registered, last_login } FROM user;
SELECT * FROM person:john;                    -- по ID
SELECT * FROM person:john, person:jane;       -- несколько ID
SELECT * FROM person:["john", "jane"];        -- массив ID

-- UPDATE
UPDATE person:john SET age = 31;
UPDATE person SET status = "active" WHERE age >= 18;
UPDATE person:john CONTENT { name: "Johnny", age: 31 };  -- полная замена
UPDATE person MERGE { last_seen: time::now() };          -- частичное обновление

-- DELETE
DELETE person:john;
DELETE person WHERE age < 18;

-- UPSERT (INSERT или UPDATE)
UPSERT person:john SET name = "John", age = 30;

-- INSERT (как в SQL)
INSERT INTO person { id: person:john, name: "John" };
INSERT INTO person [ { name: "A" }, { name: "B" } ];
```

### 4.2 Определение схемы

```sql
-- Namespace и Database
DEFINE NAMESPACE app;
DEFINE DATABASE production;
USE NS app DB production;

-- Таблица
DEFINE TABLE person SCHEMAFULL;
DEFINE TABLE event SCHEMLESS;  -- по умолчанию

-- Поля
DEFINE FIELD name ON person TYPE string;
DEFINE FIELD age ON person TYPE int ASSERT $value >= 0;
DEFINE FIELD email ON person TYPE string ASSERT string::is::email($value);
DEFINE FIELD created_at ON person TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON person TYPE datetime DEFAULT time::now() VALUE time::now();

-- Computed fields (3.0+, замена futures)
DEFINE FIELD can_drive ON person COMPUTED age > 18;
DEFINE FIELD full_name ON person COMPUTED first_name + " " + last_name;

-- Record links с типизацией
DEFINE FIELD owner ON license TYPE record<person>;
DEFINE FIELD tags ON person TYPE array<string>;
DEFINE FIELD metadata ON person TYPE option<object>;

-- Индексы
DEFINE INDEX idx_name ON person FIELDS name;
DEFINE INDEX idx_email ON person FIELDS email UNIQUE;
DEFINE INDEX idx_age_name ON person FIELDS age, name;  -- compound
DEFINE INDEX idx_docs_ft ON docs FIELDS body FULLTEXT ANALYZER english;
DEFINE INDEX idx_embedding ON items FIELDS embedding HNSW DIMENSION 1536 DISTANCE COSINE;

-- Представления (Views)
DEFINE TABLE adult AS
    SELECT * FROM person WHERE age >= 18;

-- Анализаторы для полнотекстового поиска
DEFINE ANALYZER english TOKENIZERS class FILTERS snowball(english);
```

### 4.3 Графовые операции

```sql
-- Создание рёбер
RELATE person:alex->follows->person:tobie SET since = d'2024-01-01';
RELATE person:a->wrote->post:x SET published = true;

-- Траверсал
SELECT ->follows->person.name FROM person:alex;
SELECT <-follows<-person.name FROM person:tobie;
SELECT ->follows->follows->person.name FROM person:alex;
SELECT ->follows->person->wrote->post.title FROM person:alex;

-- С метаданными
SELECT * FROM follows WHERE in = person:alex AND out = person:tobie;
UPDATE follows SET strength = "low" WHERE in = person:alex AND out = person:tobie;

-- Условный траверсал
SELECT ->follows[WHERE since > d'2024-01-01']->person.name FROM person:alex;
```

### 4.4 Транзакции

```sql
-- Классические (server-side)
BEGIN;
CREATE account:one SET balance = 100;
CREATE account:two SET balance = 50;
UPDATE account:one SET balance -= 30;
UPDATE account:two SET balance += 30;
COMMIT;

-- Client-side transactions (3.0+)
-- Начинаются из SDK, позволяют добавлять операции через несколько запросов
```

### 4.5 Параметры и переменные

```sql
LET $name = "John";
LET $min_age = 18;
LET $table = "person";

SELECT * FROM type::table($table) WHERE name = $name AND age >= $min_age;

-- LET в циклах
FOR $i IN 1..10 {
    CREATE number SET value = $i;
};

-- LET с результатами запроса
LET $avg_price = (SELECT math::mean(price) AS avg_price FROM product GROUP ALL).avg_price;
SELECT name FROM product WHERE price > $avg_price;
```

### 4.6 Функции

```sql
-- Строковые
string::lowercase("HELLO");      -- "hello"
string::contains("hello", "ell"); -- true
string::is::email("a@b.com");     -- true

-- Математические
math::mean(price);               -- среднее
math::max(age);                  -- максимум
math::sqrt(16);                  -- 4

-- Временные
time::now();                     -- текущее время
time::epoch(d'2025-01-01');      -- unix timestamp

-- Типы
type::string(42);                -- "42"
type::record("person", "john");  -- person:john

-- Array
array::len([1, 2, 3]);           -- 3
array::sort([3, 1, 2]);          -- [1, 2, 3]
array::distinct([1, 1, 2]);      -- [1, 2]

-- Record
record::id(person:john);         -- "john"
record::tb(person:john);         -- "person"
record::exists(person:john);     -- true/false

-- Полнотекстовый поиск
SELECT * FROM article WHERE title @@@ "surrealdb database";
SELECT * FROM docs WHERE body @OR@ "vector graph";  -- 3.0+

-- Векторный поиск (KNN)
SELECT * FROM items WHERE embedding <|10, COSINE|> $query_embedding;

-- Геопространственные
SELECT * FROM places WHERE location INSIDE $polygon;
```

### 4.7 Агрегации и GROUP BY

```sql
SELECT 
    country,
    math::mean(age) AS avg_age,
    count() AS total
FROM person
GROUP BY country;

-- GROUP ALL — агрегация по всей таблице
SELECT math::mean(price) AS avg_price FROM product GROUP ALL;

-- Вложенные агрегации
SELECT 
    department,
    {
        avg_salary: math::mean(salary),
        max_salary: math::max(salary),
        employees: count()
    } AS stats
FROM employee
GROUP BY department;
```

### 4.8 Live Queries (реальное время)

```sql
-- Подписка на изменения
LIVE SELECT * FROM person;
LIVE SELECT name, age FROM person WHERE age >= 18;

-- В SDK получаешь поток событий: CREATE, UPDATE, DELETE
```

### 4.9 Permissions (безопасность)

```sql
-- Table-level
DEFINE TABLE person PERMISSIONS
    FOR select WHERE published = true OR $auth.id = id,
    FOR create FULL,
    FOR update WHERE $auth.id = id,
    FOR delete NONE;

-- Field-level
DEFINE FIELD email ON person TYPE string
    PERMISSIONS
        FOR select WHERE $auth.id = id,
        FOR update WHERE $auth.id = id;

-- Scoped users
DEFINE SCOPE user SESSION 24h
    SIGNUP (CREATE user SET email = $email, pass = crypto::argon2::generate($pass))
    SIGNIN (SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass));
```

### 4.10 Custom API Endpoints (3.0+)

```sql
-- Определение кастомного endpoint
DEFINE API OVERWRITE "/get_latest" FOR get
    MIDDLEWARE
        api::timeout(50ms),
    THEN {
        RETURN {
            body: SELECT * FROM comment:[time::now()-10m].. ORDER BY id DESC
        }
    };

-- Вызов из SurrealQL
api::invoke("/get_latest");

-- Вызов по HTTP
GET http://localhost:8000/api/test_ns/test_db/get_latest

-- Кастомный middleware
DEFINE FUNCTION fn::add_prefix($req: object, $next: function, $prefix: string) -> object {
    LET $res = $next($req);
    LET $res = $res + { body: $res.body + { prefix: $prefix + ": " + $res.body.message } };
    $res;
};

DEFINE API "/custom_with_args" FOR get
    MIDDLEWARE fn::add_prefix("PREFIX")
    THEN {
        RETURN {
            status: 200,
            body: { message: "original message" }
        };
    };
```

### 4.11 File Support (3.0+, experimental)

```sql
-- Включить: surreal start --allow-experimental files

-- Определение bucket
DEFINE BUCKET my_bucket BACKEND "memory";

-- Работа с файлами
f"my_bucket:/report.txt".put("Hello World");
f"my_bucket:/report.txt".get();           -- bytes
<string>f"my_bucket:/report.txt".get();    -- string
f"my_bucket:/report.txt".head();           -- metadata
f"my_bucket:/report.txt".rename("new.txt");

-- Безопасное преобразование bytes → string
type::string_lossy(<bytes>[83, 117, 114, 255, 114, 101, 97]);
```

---

## 5. Что нового в SurrealDB 3.0 (ключевые изменения)

### 5.1 Архитектурные изменения

| Изменение | Описание | Влияние |
|-----------|----------|---------|
| **Разделение values и expressions** | Чистое разделение данных и вычислений | Предсказуемое поведение, меньше багов |
| **Computed fields** | Замена `<future>` на `COMPUTED` в схеме | Логика в одном месте, всегда актуальна |
| **ID-based storage** | Каталог по ID вместо имён | Меньше места на диске, основа для переименования |
| **Synced writes по умолчанию** | Подтверждение записи только после фиксации | Безопаснее для production |
| **Document wrapper** | Метаданные и контент хранятся отдельно | Чище ответы, стабильнее views |

### 5.2 Computed Fields (замена Futures)

```sql
-- ❌ До 3.0 (future)
DEFINE FIELD can_drive ON person VALUE <future> { time::now() - born > 18y };

-- ✅ В 3.0 (computed)
DEFINE FIELD can_drive ON person COMPUTED time::now() - born > 18y;

-- Ограничения computed fields:
-- - Только top-level поля (не во вложенных объектах)
-- - Нельзя комбинировать с VALUE, DEFAULT, ASSERT
```

### 5.3 Record References

```sql
-- Двунаправленные ссылки без графовых рёбер
DEFINE FIELD owner ON license TYPE record<person> REFERENCE;
DEFINE FIELD licenses ON person COMPUTED <~license;

-- Синтаксис обратного обхода: <~ (вместо <- для графов)
SELECT name, <~license FROM person;
```

### 5.4 Client-side Transactions

```sql
-- Теперь можно начать транзакцию из SDK, добавлять операции
-- через несколько запросов, а затем commit/cancel
-- Логика принятия решения живёт в коде приложения, не в SurrealQL
```

### 5.5 GraphQL — стабильный

```sql
-- Включение
DEFINE CONFIG GRAPHQL AUTO;  -- все таблицы и функции

-- Или выборочно
DEFINE CONFIG GRAPHQL TABLES person, post FUNCTIONS my_func;

-- Endpoint: POST /graphql
-- Поддерживает: mutations, auth, permissions, depth/complexity limits
-- N+1 query optimizations
```

### 5.6 Custom API Endpoints

```sql
DEFINE API "/endpoint" FOR get|post|put|delete
    MIDDLEWARE api::timeout(100ms), fn::my_middleware()
    THEN { RETURN { status: 200, body: ... } };
```

### 5.7 Индексы (переработка)

- **Compound indexes** — prefix + range scans
- **Descending order** — `ORDER BY ... DESC` прямо из индекса
- **LIMIT-aware scans** — уважает LIMIT в запросе
- **Normalized numeric keys** — `0`, `0.0`, `0dec` равны в UNIQUE
- **Full-text OR** — `WHERE body @OR@ "term1 term2"`
- **Concurrent index builds** — по умолчанию, без блокировок

### 5.8 Surrealism (WASM-расширения)

- Расширения на Rust → компилируются в WASM
- Выполняются в sandbox внутри БД
- AI-интеграция: LLM, embeddings, vision models
- Прямой доступ к SurrealQL, схеме, файлам

### 5.9 File Support

- Нативное хранение файлов в bucket'ах
- Backends: memory, disk, object storage
- File pointers: `f"bucket:/path"`

### 5.10 Surqlize (TypeScript ORM, experimental)

```typescript
// Type-safe ORM без code generation
const users = await db.select('person')
    .where('age', '>', 18)
    .return(['name', 'email'])
    .execute();
```

### 5.11 Surreal Sync

```bash
# Миграция из других БД
surreal-sync sync neo4j   --source-uri "bolt://localhost:7687"   --source-username "neo4j"   --source-password "password"   --to-namespace "production"   --to-database "graph_data"   --surrealdb-username "root"   --surrealdb-password "secret"
```

### 5.12 SDK Updates

- **Go SDK** — v1.0 production ready
- **Java SDK** — v1.0 production ready
- **Rust SDK** — улучшенный `surrealdb-types`, derive macros
- **Python SDK** — доступен

---

## 6. SDK и примеры

### 6.1 JavaScript/TypeScript

```typescript
import { Surreal } from 'surrealdb';

const db = new Surreal();
await db.connect('ws://localhost:8000');
await db.signin({ username: 'root', password: 'root' });
await db.use({ namespace: 'app', database: 'production' });

// Query
const [people] = await db.query<[Person[]]>('SELECT * FROM person WHERE age > $age', { age: 18 });

// CRUD
const person = await db.create('person', { name: 'John', age: 30 });
const person = await db.select('person:john');
const person = await db.update('person:john', { age: 31 });
await db.delete('person:john');

// Live query
const query = await db.live('person');
for await (const notification of query) {
    console.log(notification.action, notification.result);
}

// Transactions (client-side, 3.0+)
const tx = await db.transaction();
await tx.query('CREATE account:one SET balance = 100');
await tx.query('CREATE account:two SET balance = 50');
await tx.commit();
```

### 6.2 Rust

```rust
use surrealdb::engine::remote::ws::Ws;
use surrealdb::opt::auth::Root;
use surrealdb::Surreal;

#[tokio::main]
async fn main() -> surrealdb::Result<()> {
    let db = Surreal::new::<Ws>("127.0.0.1:8000").await?;

    db.signin(Root {
        username: "root".to_string(),
        password: "secret".to_string(),
    }).await?;

    db.use_ns("app").use_db("production").await?;

    // Query
    let mut result = db.query("
        CREATE person SET name = 'John', age = 30;
        SELECT * FROM person;
    ").await?;

    let people: Vec<Person> = result.take(1)?;

    // Typed operations
    let person: Option<Person> = db
        .upsert(("person", "john"))
        .content(Person { name: "John".to_string(), age: 30 })
        .await?;

    Ok(())
}

// Static singleton
use std::sync::LazyLock;
static DB: LazyLock<Surreal<Client>> = LazyLock::new(Surreal::init);
```

**Cargo.toml:**
```toml
[dependencies]
surrealdb = { version = "3", features = ["kv-mem", "protocol-ws"] }
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
serde = { version = "1", features = ["derive"] }
```

### 6.3 Python

```python
from surrealdb import Surreal

async with Surreal("ws://localhost:8000") as db:
    await db.signin({"user": "root", "pass": "root"})
    await db.use("app", "production")

    # Query
    result = await db.query("SELECT * FROM person WHERE age > $age", {"age": 18})

    # CRUD
    person = await db.create("person", {"name": "John", "age": 30})
    person = await db.select("person:john")
    person = await db.update("person:john", {"age": 31})
    await db.delete("person:john")
```

### 6.4 Go

```go
import "github.com/surrealdb/surrealdb.go"

// Connect
ws, err := surrealdb.New("ws://localhost:8000")
if err != nil { log.Fatal(err) }

// Auth
_, err = ws.Signin(surrealdb.Signin{
    User: "root",
    Pass: "root",
})

// Use NS/DB
_, err = ws.Use("app", "production")

// Query
result, err := ws.Query("SELECT * FROM person", map[string]interface{}{})
```

### 6.5 .NET

```csharp
using SurrealDb.Net;

var client = new SurrealDbClient("ws://127.0.0.1:8000/rpc");
await client.SignIn(new RootAuth { Username = "root", Password = "root" });
await client.Use("app", "production");

var people = await client.Select<Person>("person");
```

---

## 7. Деплой и конфигурация

### 7.1 Режимы работы

| Режим | Команда | Когда использовать |
|-------|---------|-------------------|
| In-memory | `surreal start memory` | Разработка, тесты |
| File (RocksDB) | `surreal start file:/path` | Одноузловой production |
| SurrealKV | `surreal start surrealkv:/path` | Новый движок (рекомендуется) |
| TiKV | `surreal start tikv://...` | Распределённый кластер |
| FoundationDB | `surreal start fdb://...` | Распределённый кластер |
| Embedded | через SDK | Внутри приложения |

### 7.2 Переменные окружения

```bash
SURREAL_PATH="file:/data/db.db"           # путь к данным
SURREAL_LOG="info"                         # уровень логирования
SURREAL_USER="root"                        # root user
SURREAL_PASS="secret"                      # root password
SURREAL_BIND="0.0.0.0:8000"               # адрес привязки
SURREAL_ALLOW_ALL=true                     # разрешить всё (осторожно!)
SURREAL_DENY_ARBITRARY_QUERY="guest"      # запретить произвольные запросы
SURREAL_PROCESS_METRICS_REFRESH_INTERVAL=5 # интервал метрик (сек)
SURREAL_GLOBAL_BUCKET="my_bucket"         # глобальный file bucket
SURREAL_GLOBAL_BUCKET_ENFORCED=true       # принудительный глобальный bucket
```

### 7.3 Observability (OpenTelemetry)

```bash
# Метрики доступны на /metrics
# Prometheus + OTLP push
# Metric families под scope surrealdb.*

# Публичные метрики (без auth): только aggregate process gauges
# Полные метрики: требуют root auth
```

### 7.4 Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: surrealdb
spec:
  replicas: 1
  selector:
    matchLabels:
      app: surrealdb
  template:
    metadata:
      labels:
        app: surrealdb
    spec:
      containers:
      - name: surrealdb
        image: surrealdb/surrealdb:latest
        args: ["start", "--user", "root", "--pass", "$(DB_PASSWORD)", "file:/data/db.db"]
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: surrealdb-secret
              key: password
        ports:
        - containerPort: 8000
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: surrealdb-pvc
```

---

## 8. Полезные паттерны

### 8.1 Миграции

```sql
-- Версионирование через DEFINE MIGRATION (если доступно)
-- Или ручное управление:

-- Проверка существования
IF NOT EXISTS (SELECT 1 FROM info::for::table('migration') WHERE version = 1) {
    CREATE migration:1 SET applied_at = time::now();
    DEFINE TABLE user SCHEMAFULL;
    DEFINE FIELD name ON user TYPE string;
};
```

### 8.2 Сидирование данных

```sql
-- Импорт из файла
surreal import --conn http://localhost:8000 --user root --pass root --ns app --db production seed.surql

-- Или через CLI
surreal sql --conn http://localhost:8000 --user root --pass root --ns app --db production < seed.surql
```

### 8.3 Backup/Restore

```bash
# Export
surreal export --conn http://localhost:8000 --user root --pass root --ns app --db production backup.surql

# Import
surreal import --conn http://localhost:8000 --user root --pass root --ns app --db production backup.surql
```

### 8.4 Валидация схемы

```bash
# Проверка синтаксиса SurrealQL
surreal validate < query.surql
# или
surreal validate --file query.surql
```

---

## 9. Ссылки

- **Документация:** https://surrealdb.com/docs
- **SurrealQL Reference:** https://surrealdb.com/docs/reference/query-language
- **SDK Guides:** https://surrealdb.com/docs/languages
- **SurrealDB University:** https://surrealdb.com/learn
- **GitHub:** https://github.com/surrealdb/surrealdb
- **Releases/Changelog:** https://surrealdb.com/releases
- **SurrealDB Cloud:** https://surrealdb.com/cloud
- **Surrealist (GUI):** https://surrealdb.com/docs/surrealist
- **Community Discord:** https://discord.gg/surrealdb

---

*Справочник подготовлен для агента разработки. Используйте как базу знаний при работе с SurrealDB.*
