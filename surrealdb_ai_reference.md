# 🤖 SurrealDB × AI — Полный справочник для агента разработки

> **Актуальность:** май 2026 | **Версия:** SurrealDB 3.x
> **Фокус:** Vector Search, GraphRAG, Agent Memory, Surrealism WASM, Multimodal AI, MCP

---

## 1. Почему SurrealDB для AI

SurrealDB позиционируется как **AI-native multi-model database**. В отличие от классических архитектур, где нужно стыковать векторную БД (Pinecone/Weaviate), документную (MongoDB), графовую (Neo4j) и реляционную (PostgreSQL), SurrealDB объединяет всё в одном движке:

- **Векторный поиск** — HNSW-индексы, similarity search, embeddings
- **Графовая модель** — RELATE, траверсал, graph RAG
- **Документная модель** — JSON, schemaless/schemafull
- **Файловое хранилище** — изображения, аудио, документы внутри БД
- **WASM-расширения** — запуск AI-моделей прямо внутри БД (Surrealism)
- **Realtime** — live queries для потоковой обработки
- **ACID** — транзакционная целостность даже для AI-операций

**Ключевое преимущество:** данные, эмбеддинги, граф связей и файлы живут в одной транзакции. Нет ETL, нет консистентности между системами, нет сетевых хопов.citeweb_search:6#5

---

## 2. Векторный поиск (Vector Search)

### 2.1 HNSW-индексы

SurrealDB использует HNSW (Hierarchical Navigable Small World) — графовый индекс для приближённого поиска ближайших соседей (ANN).

```sql
-- Создание векторного индекса
DEFINE INDEX idx_embedding ON items FIELDS embedding
    HNSW DIMENSION 1536          -- размерность вектора
    DISTANCE COSINE              -- метрика: COSINE, EUCLIDEAN, MANHATTAN, CHEBYSHEV, HAMMING, MINKOWSKI
    EFC 500                      -- размер кандидатов при построении (больше = точнее, медленнее)
    M 32;                        -- максимальное число связей на уровне

-- Типы данных для векторов
DEFINE FIELD embedding ON items TYPE array<float>;
-- или
DEFINE FIELD embedding ON items TYPE array<double>;
```

**Параметры HNSW:**
- `DIMENSION` — обязательный, размерность вектора (например, 1536 для OpenAI, 768 для sentence-transformers, 1024 для modern BERT)
- `DISTANCE` — метрика расстояния. `COSINE` — стандарт для семантических эмбеддингов
- `EFC` (efConstruction) — качество построения индекса. Default ~100-500
- `M` — максимальная степень вершины. Default ~16-32

### 2.2 KNN-запросы (K-Nearest Neighbors)

```sql
-- Поиск 10 ближайших соседей по косинусному расстоянию
SELECT * FROM items
WHERE embedding <|10, COSINE|> $query_embedding;

-- С фильтрами
SELECT id, title, embedding <|5, COSINE|> $query_embedding AS similarity
FROM articles
WHERE category = "tech" AND published = true
ORDER BY similarity DESC;

-- Получение расстояния
SELECT id, vector::distance::cosine(embedding, $query_embedding) AS dist
FROM items
ORDER BY dist ASC
LIMIT 10;
```

### 2.3 Гибридный поиск (Hybrid Search)

Комбинация векторного similarity + полнотекстового поиска (BM25).

```sql
-- Индексы
DEFINE INDEX idx_embedding ON docs FIELDS embedding HNSW DIMENSION 1536 DISTANCE COSINE;
DEFINE INDEX idx_content_ft ON docs FIELDS content FULLTEXT ANALYZER english;

-- Гибридный запрос
SELECT id, content,
    embedding <|5, COSINE|> $query_embedding AS vector_score,
    search::score(1) AS text_score
FROM docs
WHERE content @@@ $query_text
    OR embedding <|5, COSINE|> $query_embedding
ORDER BY (vector_score * 0.7 + text_score * 0.3) DESC;
```

**Практический паттерн (SuperOptiX):**citeweb_search:6#7
```sql
-- Таблица для RAG
DEFINE TABLE rag_documents SCHEMAFULL;
DEFINE FIELD content ON rag_documents TYPE string;
DEFINE FIELD embedding ON rag_documents TYPE array<float>;
DEFINE FIELD metadata ON rag_documents TYPE object;

-- Индексы
DEFINE INDEX idx_embedding ON rag_documents FIELDS embedding
    HNSW DIMENSION 1536 DISTANCE COSINE;
DEFINE INDEX idx_content_ft ON rag_documents FIELDS content FULLTEXT ANALYZER english;
DEFINE INDEX idx_entity ON rag_documents FIELDS metadata.entity_id;
```

### 2.4 Работа с эмбеддингами

```sql
-- Вставка документа с эмбеддингом (эмбеддинг генерируется вне БД)
CREATE rag_documents:doc1 CONTENT {
    content: "SurrealDB is a multi-model database",
    embedding: [0.023, -0.156, 0.789, ...],  -- 1536 чисел
    metadata: { source: "docs", topic: "database" }
};

-- Batch insert
INSERT INTO rag_documents [
    { content: "A", embedding: [...], metadata: {...} },
    { content: "B", embedding: [...], metadata: {...} }
];

-- Обновление эмбеддинга
UPDATE rag_documents:doc1 SET embedding = $new_embedding;
```

---

## 3. GraphRAG — Граф + Векторы

### 3.1 Почему GraphRAG лучше обычного RAG

| Обычный RAG | GraphRAG |
|-------------|----------|
| Только семантическое сходство чанков | + структурированные связи между сущностями |
| Теряет контекст между чанками | Сохраняет отношения (автор → документ → тема) |
| Не умеет рассуждать о связях | Многошаговые рассуждения через граф |
| Галлюцинации при сложных вопросах | Более точные ответы благодаря графу знаний |citeweb_search:6#3

### 3.2 Моделирование знаний для GraphRAG

```sql
-- Сущности
DEFINE TABLE person SCHEMAFULL;
DEFINE FIELD name ON person TYPE string;
DEFINE FIELD description ON person TYPE string;
DEFINE FIELD embedding ON person TYPE array<float>;

DEFINE TABLE place SCHEMAFULL;
DEFINE FIELD name ON place TYPE string;
DEFINE FIELD embedding ON place TYPE array<float>;

-- Связи (рёбра графа)
DEFINE TABLE RELATED_TO TYPE RELATION IN person OUT person;
DEFINE FIELD strength ON RELATED_TO TYPE int;
DEFINE FIELD description ON RELATED_TO TYPE string;

DEFINE TABLE VISITED TYPE RELATION IN person OUT place;
DEFINE FIELD frequency ON VISITED TYPE int;

-- Индексы
DEFINE INDEX idx_person_emb ON person FIELDS embedding HNSW DIMENSION 1536 DISTANCE COSINE;
DEFINE INDEX idx_place_emb ON place FIELDS embedding HNSW DIMENSION 1536 DISTANCE COSINE;
```

### 3.3 Заполнение графа

```sql
-- Создание сущностей
CREATE person:alex SET
    name = "Alex Mercer",
    description = "Main character, leader of Paranormal Military Squad",
    embedding = [...];

CREATE person:jordan SET
    name = "Jordan Hayes",
    description = "Brilliant scientist, Alex's closest ally",
    embedding = [...];

CREATE place:dulce SET
    name = "Dulce Base",
    description = "Secret underground facility in New Mexico",
    embedding = [...];

-- Связи
RELATE person:alex->RELATED_TO->person:jordan
    SET strength = 9, description = "Close working relationship, mutual respect";

RELATE person:alex->VISITED->place:dulce
    SET frequency = 5;
```

### 3.4 Функция GraphRAG-ретривала

```sql
-- Функция: найти похожие сущности + их граф
DEFINE FUNCTION OVERWRITE fn::get_related_entities($text: string) {
    -- 1. Получаем эмбеддинг запроса (генерируется вне БД или через Surrealism)
    LET $emb = fn::sentence_to_vector($text);

    -- 2. Векторный поиск + траверсал связей
    RETURN SELECT id, description,
        ->RELATED_TO.{out, strength, description} AS relationships
    FROM person
    WHERE embedding <|5, COSINE|> $emb;
};

-- Использование
LET $context = fn::get_related_entities("Who is the main character?");
```

### 3.5 Multi-Cycle Reasoning (Reflexion RAG)

Продвинутый паттерн: агент делает несколько циклов "генерация → оценка → доработка", используя SurrealDB как хранилище контекста.citeweb_search:6#10

```sql
-- Таблица для циклов reasoning
DEFINE TABLE reasoning_cycles SCHEMAFULL;
DEFINE FIELD query ON reasoning_cycles TYPE string;
DEFINE FIELD cycle_num ON reasoning_cycles TYPE int;
DEFINE FIELD retrieved_docs ON reasoning_cycles TYPE array<record<rag_documents>>;
DEFINE FIELD confidence ON reasoning_cycles TYPE float;
DEFINE FIELD gaps ON reasoning_cycles TYPE array<string>;
DEFINE FIELD response ON reasoning_cycles TYPE string;

-- Агент записывает каждый цикл
CREATE reasoning_cycles SET
    query = "Compare SurrealDB vector search with traditional DBs",
    cycle_num = 1,
    retrieved_docs = [rag_documents:arch1, rag_documents:guide1],
    confidence = 0.78,
    gaps = ["missing performance benchmarks"],
    response = "...";

-- Следующий цикл: уточняющий запрос
CREATE reasoning_cycles SET
    query = "SurrealDB HNSW indexing performance benchmarks",
    cycle_num = 2,
    retrieved_docs = [rag_documents:bench1, ...],
    confidence = 0.89,
    gaps = [],
    response = "...final answer...";
```

---

## 4. Surrealism — WASM-расширения для AI

### 4.1 Что такое Surrealism

Surrealism — система расширений на WebAssembly. Позволяет писать функции на Rust (скоро JS, Python), компилировать в WASM и выполнять внутри SurrealDB в sandbox.citeweb_search:6#1citeweb_search:6#8

**Ключевые возможности для AI:**
- Запуск локальных LLM / embedding моделей внутри БД
- Вызов внешних API (OpenAI, Anthropic, Bedrock) из SurrealQL
- GPU-инференс рядом с данными
- Обработка изображений, аудио, видео
- Кастомные токенизаторы и анализаторы

### 4.2 Архитектура

```
Query Engine → WASM Sandbox → Module (Rust → WASM)
                    ↓
              Host Bridge → SurrealQL callbacks
                    ↓
              ACID Transaction (shared)
```

- Каждый вызов — изолированный WASM instance
- Нет прямого доступа к ФС, сети, БД
- Взаимодействие через host functions
- Все операции в одной транзакции с вызывающим запросом

### 4.3 Пример: AI-функция внутри БД

```rust
// Rust-код расширения
use surrealism::prelude::*;

#[surrealism]
fn sentence_to_vector(text: String) -> Vec<f32> {
    // Здесь вызывается локальная модель (ONNX, Candle, etc.)
    // или удалённый API
    let embedding = local_embedder.encode(&text);
    embedding
}

#[surrealism]
fn classify_sentiment(text: String) -> String {
    let score = sentiment_model.predict(&text);
    if score > 0.5 { "positive".to_string() }
    else if score < -0.5 { "negative".to_string() }
    else { "neutral".to_string() }
}

#[surrealism]
fn generate_summary(text: String, max_words: i32) -> String {
    // Вызов LLM API или локальной модели
    let summary = llm.summarize(&text, max_words as usize);
    summary
}
```

```toml
# surrealism.toml
[package]
organisation = "mycompany"
name = "ai_extensions"
version = "1.0.0"
```

```bash
# Компиляция
surrealism build
# → ai_extensions.wasm
```

```sql
-- Загрузка в SurrealDB
DEFINE BUCKET modules BACKEND "disk";
DEFINE MODULE ai_extensions
    FROM f"modules:/ai_extensions.wasm";

-- Использование в SurrealQL
CREATE article SET
    title = "News",
    content = "...",
    embedding = mod::ai_extensions::sentence_to_vector(content),
    sentiment = mod::ai_extensions::classify_sentiment(content);

-- Генерация ответа на основе контекста
SELECT mod::ai_extensions::generate_summary(
    "Context: " + array::join(->references->article.content, "\n")
    + "\nQuestion: " + $question,
    100
) AS answer
FROM knowledge_base WHERE id = $topic_id;
```

### 4.4 Datagentic-воркфлоу

"Datagentic" — термин SurrealDB для workflow, где логика и AI-модели живут внутри данных, а не на внешних сервисах.citeweb_search:6#0

```sql
-- Пример: транскрибация аудио → NER → обогащение → сохранение
-- Всё в одной транзакции
CREATE audio_record:meeting1 SET
    file = f"bucket:/meetings/recording.wav",
    transcript = mod::ai::transcribe(file.get()),
    entities = mod::ai::extract_entities(transcript),
    summary = mod::ai::summarize(transcript, 200),
    embedding = mod::ai::embed(summary);

-- Автоматическое создание графа знаний
FOR $entity IN entities {
    CREATE entity SET name = $entity.name, type = $entity.type;
    RELATE audio_record:meeting1->MENTIONS->entity;
};
```

### 4.5 Локальные модели vs API

| Режим | Как | Когда |
|-------|-----|-------|
| **Локальная модель** | WASM + ONNX Runtime / Candle / llama.cpp | Приватность, edge, низкая латентность |
| **Remote API** | WASM-модуль делает HTTP-запрос | Большие модели, GPU-кластеры |
| **GPU-инференс** | WASM + host bridge к CUDA/Metal | Высокая производительность |

---

## 5. File Support — Мультимодальные данные

### 5.1 Нативное хранение файлов

SurrealDB 3.0+ поддерживает хранение файлов (изображения, аудио, PDF, видео) внутри bucket'ов.citeweb_search:6#0

```sql
-- Включить экспериментальный режим
-- surreal start --allow-experimental files

-- Определение bucket
DEFINE BUCKET media BACKEND "disk";
DEFINE BUCKET temp BACKEND "memory";

-- Глобальный bucket через env:
-- SURREAL_GLOBAL_BUCKET="media"
-- SURREAL_GLOBAL_BUCKET_ENFORCED=true

-- Загрузка файла
f"media:/images/photo1.jpg".put($image_bytes);
f"media:/audio/speech.wav".put($audio_bytes);
f"media:/docs/contract.pdf".put($pdf_bytes);

-- Чтение
LET $img = f"media:/images/photo1.jpg".get();     -- bytes
LET $meta = f"media:/images/photo1.jpg".head();    -- metadata

-- Безопасное преобразование в строку
type::string_lossy($img);  -- заменяет невалидный UTF-8 на �
```

### 5.2 AI-пайплайн с файлами

```sql
-- Таблица мультимодальных документов
DEFINE TABLE media_items SCHEMAFULL;
DEFINE FIELD file_path ON media_items TYPE string;
DEFINE FIELD file_type ON media_items TYPE string;      -- "image", "audio", "video"
DEFINE FIELD extracted_text ON media_items TYPE string;
DEFINE FIELD embedding ON media_items TYPE array<float>;
DEFINE FIELD metadata ON media_items TYPE object;

-- Индекс
DEFINE INDEX idx_media_emb ON media_items FIELDS embedding
    HNSW DIMENSION 512 DISTANCE COSINE;  -- CLIP-like embeddings

-- Процессинг через Surrealism
CREATE media_items SET
    file_path = "media:/images/receipt.jpg",
    file_type = "image",
    extracted_text = mod::vision::ocr(f"media:/images/receipt.jpg".get()),
    embedding = mod::vision::clip_embed(f"media:/images/receipt.jpg".get()),
    metadata = { source: "camera", timestamp: time::now() };

-- Поиск похожих изображений
SELECT * FROM media_items
WHERE embedding <|5, COSINE|> $query_image_embedding
AND file_type = "image";
```

### 5.3 Мультимодальный RAG

```sql
-- Пользователь загружает изображение и спрашивает текстом
LET $img_emb = mod::vision::clip_embed(f"media:/query.jpg".get());
LET $text_emb = mod::nlp::embed("What is shown in this image?");

-- Объединённый эмбеддинг (early fusion)
LET $combined = array::concat($img_emb, $text_emb);

-- Поиск по мультимодальному индексу
SELECT id, description, file_path,
    multimodal_embedding <|5, COSINE|> $combined AS score
FROM media_items
ORDER BY score DESC;
```

---

## 6. AI Agent Memory — Память для агентов

### 6.1 Архитектуры памяти

SurrealDB предлагает несколько паттернов для памяти AI-агентов:

#### A. Vector Memory (семантическая память)
```sql
DEFINE TABLE memory_chunks SCHEMAFULL;
DEFINE FIELD content ON memory_chunks TYPE string;
DEFINE FIELD embedding ON memory_chunks TYPE array<float>;
DEFINE FIELD agent_id ON memory_chunks TYPE string;
DEFINE FIELD session_id ON memory_chunks TYPE string;
DEFINE FIELD timestamp ON memory_chunks TYPE datetime DEFAULT time::now();
DEFINE FIELD importance ON memory_chunks TYPE float;  -- приоритет для ретеншна

DEFINE INDEX idx_mem_emb ON memory_chunks FIELDS embedding
    HNSW DIMENSION 1536 DISTANCE COSINE;

-- Агент сохраняет опыт
CREATE memory_chunks SET
    content = "User prefers dark mode and uses Python",
    embedding = $embedding,
    agent_id = "agent_001",
    session_id = "sess_42",
    importance = 0.8;

-- Ретривал релевантного опыта
SELECT content FROM memory_chunks
WHERE agent_id = "agent_001"
AND embedding <|10, COSINE|> $current_context_embedding
ORDER BY importance DESC, timestamp DESC;
```

#### B. Episodic Memory (эпизодическая)
```sql
DEFINE TABLE episodes SCHEMAFULL;
DEFINE FIELD agent_id ON episodes TYPE string;
DEFINE FIELD episode_type ON episodes TYPE string;  -- "action", "observation", "thought"
DEFINE FIELD content ON episodes TYPE string;
DEFINE FIELD embedding ON episodes TYPE array<float>;
DEFINE FIELD prev_episode ON episodes TYPE option<record<episodes>>;
DEFINE FIELD timestamp ON episodes TYPE datetime DEFAULT time::now();

-- Цепочка мыслей
CREATE episodes:ep1 SET agent_id = "a1", episode_type = "observation",
    content = "User asked about weather", embedding = [...];
CREATE episodes:ep2 SET agent_id = "a1", episode_type = "thought",
    content = "I should check weather API", embedding = [...], prev_episode = episodes:ep1;
CREATE episodes:ep3 SET agent_id = "a1", episode_type = "action",
    content = "Called weather API", embedding = [...], prev_episode = episodes:ep2;

-- Траверсал цепочки
SELECT * FROM episodes:ep3.{prev_episode}*;  -- вся цепочка назад
```

#### C. Graph Memory (знания в графе)
```sql
-- Сущности, которые агент узнал
DEFINE TABLE entity SCHEMAFULL;
DEFINE FIELD name ON entity TYPE string;
DEFINE FIELD entity_type ON entity TYPE string;  -- "person", "place", "concept"
DEFINE FIELD embedding ON entity TYPE array<float>;

DEFINE TABLE knows TYPE RELATION IN entity OUT entity;
DEFINE TABLE located_at TYPE RELATION IN entity OUT entity;

-- Агент извлёк знания из диалога
CREATE entity:eiffel SET name = "Eiffel Tower", entity_type = "place", embedding = [...];
CREATE entity:paris SET name = "Paris", entity_type = "place", embedding = [...];
RELATE entity:eiffel->located_at->entity:paris;

-- Позже агент использует граф для ответа
SELECT name, ->located_at->entity.name AS city FROM entity WHERE name = "Eiffel Tower";
```

### 6.2 Spectron — Agent Memory Platform

Spectron — коммерческое решение на базе SurrealDB для памяти агентов.citeweb_search:6#11

**Фичи:**
- **MCP Server** — стандартный Model Context Protocol, подключается к любому MCP-клиенту (Claude Desktop, Cursor, Copilot, Zed, n8n)
- **Entity Search** — HNSW по сущностям
- **Fact Chain Traversal** — рекурсивный DFS по графу фактов (глубина 3)
- **ACID транзакции** — память коммитится атомарно
- **RBAC + Record-level permissions** — безопасность на уровне данных

```sql
-- Пример использования Spectron через MCP
-- Агент вызывает tool: ingest_memory
CREATE memory_chunks SET
    content = $memory_text,
    embedding = $embedding,
    metadata = { entity_id: $entity_id, source: $source };

-- Tool: query_memory
SELECT content FROM memory_chunks
WHERE embedding <|5, COSINE|> $query_embedding;

-- Tool: traverse_facts
SELECT * FROM entity WHERE id = $start_entity
.{->knows->entity}*;  -- все связанные сущности
```

### 6.3 SuperOptiX — RAG + Agent Framework

SuperOptiX использует SurrealDB для GraphRAG с несколькими режимами ретривала:citeweb_search:6#7

```python
# Python-псевдокод
retrieval_mode = "multi"  # vector | hybrid | graph | multi

# 1. Vector — чистый семантический поиск
# 2. Hybrid — vector + BM25
# 3. Graph — векторный поиск seed + траверсал рёбер
# 4. Multi — hybrid + graph expansion
```

---

## 7. SurrealMCP — Model Context Protocol

### 7.1 Что такое MCP

Model Context Protocol (MCP) — открытый стандарт Anthropic для подключения AI-ассистентов к внешним данным и инструментам. SurrealMCP — официальная реализация MCP-сервера для SurrealDB.citeweb_search:6#4

### 7.2 Установка

```bash
# Из исходников
cargo install --git https://github.com/surrealdb/surrealmcp

# Или Docker
docker run -p 3000:3000 surrealdb/surrealmcp

# Запуск
surrealmcp start   --endpoint http://localhost:8000   --namespace app   --database production   --username root   --password secret
```

### 7.3 Интеграция с клиентами

**Claude Desktop:**
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "surrealdb": {
      "command": "surrealmcp",
      "args": ["start", "--endpoint", "http://localhost:8000"],
      "env": {
        "SURREALDB_USER": "root",
        "SURREALDB_PASS": "root"
      }
    }
  }
}
```

**Cursor / VS Code Copilot / Zed / n8n** — аналогично через MCP-конфиг.

### 7.4 Доступные tools

SurrealMCP предоставляет AI-агенту инструменты:
- `query` — выполнение SurrealQL
- `insert` — вставка данных
- `update` — обновление
- `delete` — удаление
- `search` — векторный поиск
- `traverse` — графовый траверсал
- `schema_info` — introspection схемы

---

## 8. LangChain интеграция

### 8.1 Python SDK

```bash
pip install langchain-surrealdb
```

```python
from langchain_surrealdb import SurrealDBVectorStore
from langchain_openai import OpenAIEmbeddings

# Подключение
vector_store = SurrealDBVectorStore(
    db_url="ws://localhost:8000",
    ns="app",
    db="production",
    collection="documents",
    embedding=OpenAIEmbeddings(),
    username="root",
    password="root",
)

# Добавление документов
from langchain_core.documents import Document
docs = [Document(page_content="SurrealDB is great", metadata={"source": "docs"})]
vector_store.add_documents(docs)

# Поиск
results = vector_store.similarity_search("database", k=5)

# С фильтром
results = vector_store.similarity_search(
    "surreal",
    k=1,
    custom_filter={"source": "https://surrealdb.com"}
)

# Retriever для RAG-цепочки
retriever = vector_store.as_retriever(
    search_type="mmr",  # Maximal Marginal Relevance
    search_kwargs={"k": 5, "lambda_mult": 0.5}
)
```

### 8.2 GraphRAG с LangChain

```python
# Кастомный retriever, использующий граф
async def graph_rag_retrieve(query: str):
    # 1. Получаем эмбеддинг запроса
    embedding = await embedder.aembed_query(query)

    # 2. Векторный поиск seed-записей
    seeds = await db.query(
        "SELECT * FROM person WHERE embedding <|5, COSINE|> $emb",
        {"emb": embedding}
    )

    # 3. Графовый траверсал
    context = []
    for seed in seeds:
        related = await db.query(
            "SELECT id, description, ->RELATED_TO.* FROM $seed",
            {"seed": seed["id"]}
        )
        context.extend(related)

    return context

# Использование в цепочке
from langchain.chains import RetrievalQA
chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=graph_rag_retriever,
    return_source_documents=True
)
```

---

## 9. Практические AI-архитектуры

### 9.1 Классический RAG (Document QA)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Документы  │────▶│  Chunking    │────▶│ Embeddings  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    LLM      │◀────│   Prompt     │◀────│  SurrealDB  │
│  (OpenAI)   │     │  Engineering │     │  (Vector+FT)│
└─────────────┘     └──────────────┘     └─────────────┘
```

```sql
-- Схема
DEFINE TABLE chunks SCHEMAFULL;
DEFINE FIELD content ON chunks TYPE string;
DEFINE FIELD embedding ON chunks TYPE array<float>;
DEFINE FIELD source ON chunks TYPE string;
DEFINE FIELD metadata ON chunks TYPE object;

DEFINE INDEX idx_chunk_emb ON chunks FIELDS embedding
    HNSW DIMENSION 1536 DISTANCE COSINE;
DEFINE INDEX idx_chunk_ft ON chunks FIELDS content FULLTEXT ANALYZER english;

-- Ретривал
DEFINE FUNCTION fn::rag_retrieve($query: string, $k: int) {
    LET $emb = fn::embed($query);  -- через Surrealism
    LET $vector_results = SELECT id, content FROM chunks
        WHERE embedding <|$k, COSINE|> $emb;
    LET $text_results = SELECT id, content FROM chunks
        WHERE content @@@ $query;
    RETURN array::union($vector_results, $text_results);
};
```

### 9.2 GraphRAG (Knowledge Graph QA)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Корпус     │────▶│  NER +       │────▶│  Entities   │
│  текстов    │     │  Relation    │     │  + Edges    │
└─────────────┘     │  Extraction  │     └──────┬──────┘
                    └──────────────┘            │
                           │                    ▼
                    ┌──────┴──────┐      ┌─────────────┐
                    │  Embeddings  │────▶│  SurrealDB  │
                    └─────────────┘      │ (Graph+HNSW)│
                                         └─────────────┘
```

```sql
-- Пайплайн
-- 1. Извлечение сущностей (через Surrealism или внешний сервис)
-- 2. Создание записей
CREATE person:alex SET name = "Alex", embedding = [...];
CREATE place:dulce SET name = "Dulce Base", embedding = [...];

-- 3. Связи
RELATE person:alex->RELATED_TO->person:jordan SET strength = 9;
RELATE person:alex->VISITED->place:dulce SET frequency = 5;

-- 4. Запрос
SELECT * FROM fn::get_related_entities($user_question);
```

### 9.3 Multi-Agent System с Shared Memory

```sql
-- Таблица shared memory
DEFINE TABLE shared_memory SCHEMAFULL;
DEFINE FIELD content ON shared_memory TYPE string;
DEFINE FIELD embedding ON shared_memory TYPE array<float>;
DEFINE FIELD agent_id ON shared_memory TYPE string;
DEFINE FIELD task_id ON shared_memory TYPE string;
DEFINE FIELD memory_type ON shared_memory TYPE string;  -- "fact", "plan", "result"
DEFINE FIELD access_level ON shared_memory TYPE string;  -- "public", "team", "private"

-- Права доступа
DEFINE TABLE shared_memory PERMISSIONS
    FOR select WHERE access_level = "public" OR agent_id = $auth.id,
    FOR create FULL,
    FOR update WHERE agent_id = $auth.id;

-- Агент A сохраняет результат
CREATE shared_memory SET
    content = "API response: temperature = 22°C",
    embedding = [...],
    agent_id = "weather_agent",
    task_id = "task_123",
    memory_type = "result",
    access_level = "public";

-- Агент B находит релевантную информацию
SELECT content FROM shared_memory
WHERE task_id = "task_123"
AND embedding <|5, COSINE|> $query_embedding
AND access_level = "public";
```

### 9.4 Multi-Modal AI (Vision + Text)

```sql
-- Хранение мультимодальных данных
DEFINE TABLE assets SCHEMAFULL;
DEFINE FIELD file_ref ON assets TYPE string;           -- f"bucket:/..."
DEFINE FIELD asset_type ON assets TYPE string;         -- "image", "audio", "video"
DEFINE FIELD text_description ON assets TYPE string;
DEFINE FIELD text_embedding ON assets TYPE array<float>;    -- 1536d
DEFINE FIELD image_embedding ON assets TYPE array<float>;   -- 512d (CLIP)
DEFINE FIELD combined_embedding ON assets TYPE array<float>; -- 2048d (concat)

-- Индексы
DEFINE INDEX idx_text ON assets FIELDS text_embedding HNSW DIMENSION 1536 DISTANCE COSINE;
DEFINE INDEX idx_image ON assets FIELDS image_embedding HNSW DIMENSION 512 DISTANCE COSINE;
DEFINE INDEX idx_combined ON assets FIELDS combined_embedding HNSW DIMENSION 2048 DISTANCE COSINE;

-- Поиск по тексту, возвращает изображения
SELECT file_ref, text_description FROM assets
WHERE text_embedding <|5, COSINE|> $text_query_embedding
AND asset_type = "image";

-- Поиск по изображению
SELECT file_ref, text_description FROM assets
WHERE image_embedding <|5, COSINE|> $image_query_embedding;
```

### 9.5 Self-Improving Agent (Reflexion)

```sql
-- Таблица для циклов самоулучшения
DEFINE TABLE agent_reflexion SCHEMAFULL;
DEFINE FIELD agent_id ON agent_reflexion TYPE string;
DEFINE FIELD task ON agent_reflexion TYPE string;
DEFINE FIELD cycle ON agent_reflexion TYPE int;
DEFINE FIELD thought ON agent_reflexion TYPE string;
DEFINE FIELD action ON agent_reflexion TYPE string;
DEFINE FIELD observation ON agent_reflexion TYPE string;
DEFINE FIELD reward ON agent_reflexion TYPE float;
DEFINE FIELD embedding ON agent_reflexion TYPE array<float>;

-- Агент записывает каждый шаг
CREATE agent_reflexion SET
    agent_id = "coder_agent",
    task = "Fix bug #123",
    cycle = 1,
    thought = "The bug is in the auth module",
    action = "Check auth.rs line 45",
    observation = "Null pointer on unwrap",
    reward = 0.3,
    embedding = [...];

-- Поиск похожих ситуаций для few-shot learning
SELECT * FROM agent_reflexion
WHERE agent_id = "coder_agent"
AND embedding <|3, COSINE|> $current_situation_embedding
ORDER BY reward DESC;
```

---

## 10. Интеграция с внешними AI-платформами

### 10.1 Amazon Bedrock

```python
import boto3
from surrealdb import Surreal

bedrock = boto3.client("bedrock-runtime")
db = Surreal("ws://localhost:8000")

# 1. Генерация эмбеддингов через Titan
response = bedrock.invoke_model(
    modelId="amazon.titan-embed-text-v2:0",
    body=json.dumps({"inputText": text})
)
embedding = json.loads(response["body"].read())["embedding"]

# 2. Сохранение в SurrealDB
await db.create("chunks", {"content": text, "embedding": embedding})

# 3. Генерация SurrealQL-запроса через Claude
response = bedrock.invoke_model(
    modelId="anthropic.claude-3-sonnet",
    body=json.dumps({
        "prompt": f"Generate SurrealQL query to find related entities for: {question}",
        "max_tokens": 500
    })
)
surql_query = extract_query(response)

# 4. Выполнение
result = await db.query(surql_query)

# 5. Генерация ответа
final = bedrock.invoke_model(
    modelId="anthropic.claude-3-sonnet",
    body=json.dumps({
        "prompt": f"Context: {result}\nQuestion: {question}"
    })
)
```

### 10.2 Ollama (локальные модели)

```python
import requests

# Локальный эмбеддинг
res = requests.post("http://localhost:11434/api/embeddings", json={
    "model": "nomic-embed-text",
    "prompt": text
})
embedding = res.json()["embedding"]

# Локальный LLM
res = requests.post("http://localhost:11434/api/generate", json={
    "model": "llama3.1",
    "prompt": prompt,
    "stream": False
})
answer = res.json()["response"]
```

### 10.3 OpenAI

```python
from openai import OpenAI
client = OpenAI()

# Embeddings
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=text
)
embedding = response.data[0].embedding

# Chat
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": f"Context: {context}\nQuestion: {question}"}
    ]
)
```

---

## 11. Производительность и оптимизация

### 11.1 Векторные индексы

- **HNSW** — лучший выбор для большинства случаев. O(log N) поиск, но требует памяти.
- **Brute force** — если данных < 10k, индекс может не понадобиться.
- **Размерность** — используйте `text-embedding-3-small` (1536d) или сжимайте до 256d через PCA.
- **Тип данных** — `array<float>` быстрее, чем `array<double>`, и занимает в 2 раза меньше места.

### 11.2 Batch операции

```sql
-- Batch insert через INSERT
INSERT INTO chunks [
    { content: "A", embedding: [...] },
    { content: "B", embedding: [...] },
    ... 1000 записей
];

-- Или через SDK
await db.query("INSERT INTO chunks $data", {"data": large_array});
```

### 11.3 Кэширование контекста

```sql
-- Таблица кэша ответов
DEFINE TABLE response_cache SCHEMAFULL;
DEFINE FIELD query_hash ON response_cache TYPE string;
DEFINE FIELD query_embedding ON response_cache TYPE array<float>;
DEFINE FIELD response ON response_cache TYPE string;
DEFINE FIELD hit_count ON response_cache TYPE int DEFAULT 0;

DEFINE INDEX idx_cache ON response_cache FIELDS query_embedding
    HNSW DIMENSION 1536 DISTANCE COSINE;

-- Проверка кэша перед вызовом LLM
LET $cached = SELECT * FROM response_cache
    WHERE query_embedding <|1, COSINE|> $query_embedding
    AND vector::distance::cosine(query_embedding, $query_embedding) < 0.05;

IF $cached {
    UPDATE $cached.id SET hit_count += 1;
    RETURN $cached.response;
} ELSE {
    LET $response = mod::ai::generate($query);
    CREATE response_cache SET
        query_hash = crypto::sha256($query),
        query_embedding = $query_embedding,
        response = $response;
    RETURN $response;
};
```

---

## 12. Безопасность в AI-системах

### 12.1 Изоляция данных агентов

```sql
-- Namespace per tenant
DEFINE NAMESPACE tenant_abc;
DEFINE DATABASE agent_memory;

-- Record-level permissions
DEFINE TABLE memory_chunks PERMISSIONS
    FOR select WHERE metadata.tenant_id = $auth.tenant_id,
    FOR create WHERE metadata.tenant_id = $auth.tenant_id,
    FOR update WHERE metadata.tenant_id = $auth.tenant_id,
    FOR delete WHERE metadata.tenant_id = $auth.tenant_id;

-- Scoped auth для агентов
DEFINE SCOPE agent SESSION 1h
    SIGNIN (SELECT * FROM agent WHERE id = $agent_id AND api_key = $api_key);
```

### 12.2 Rate limiting через API endpoints

```sql
DEFINE API "/agent_query" FOR post
    MIDDLEWARE
        api::timeout(5000ms),
        fn::rate_limit($auth.id, 100)  -- 100 запросов/мин
    THEN {
        LET $result = SELECT * FROM memory_chunks
            WHERE embedding <|5, COSINE|> $body.embedding;
        RETURN { status: 200, body: $result };
    };
```

### 12.3 PII-фильтрация через Surrealism

```rust
#[surrealism]
fn redact_pii(text: String) -> String {
    // Regex для email, phone, SSN
    let redacted = regex_replace_email(&text, "[REDACTED_EMAIL]");
    regex_replace_phone(&redacted, "[REDACTED_PHONE]")
}
```

```sql
CREATE memory_chunks SET
    content = mod::privacy::redact_pii($raw_text),
    embedding = mod::ai::embed(mod::privacy::redact_pii($raw_text));
```

---

## 13. Полезные ссылки

- **SurrealDB AI Blog:** https://surrealdb.com/blog (разделы про AI, GraphRAG, Agent Memory)
- **Surrealism Docs:** https://surrealdb.com/surrealism
- **SurrealMCP:** https://github.com/surrealdb/surrealmcp
- **LangChain Integration:** https://docs.langchain.com/oss/python/integrations/vectorstores/surrealdb
- **Spectron (Agent Memory):** https://surrealdb.com/platform/spectron
- **SuperOptiX:** https://medium.com/superagentic-ai/building-agent-memory-on-surrealdb
- **GraphRAG Tutorial:** https://surrealdb.com/blog/make-a-genai-chatbot-using-graphrag-with-surrealdb-langchain
- **SurrealDB University:** https://surrealdb.com/learn
- **Discord:** https://discord.gg/surrealdb

---

*Справочник подготовлен для AI-агентов разработки. Используйте как базу знаний при проектировании RAG, Agent Memory и AI-интеграций на SurrealDB.*
