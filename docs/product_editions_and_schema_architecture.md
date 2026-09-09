# 🏛️ Архитектура Продуктовых Редакций (Base, Pro, Ultra) и Модульной Схемы SurrealDB

В данном документе описана архитектура разделения приложения **WorldWiki** на три продуктовые редакции (**Base**, **Pro**, **Ultra**), включая изоляцию фронтенд-бандлов, компиляцию Rust-бэкенда и послойную DDL-схему SurrealDB с правилами идемпотентного применения через `OVERWRITE`.

---

## 📊 1. Матрица Редакций и Возможностей

| Возможность / Слой | 🟢 Base (Базовый) | 🔷 Pro (Облачный AI) | 🟣 Ultra (Локальный + Облачный) |
|---|---|---|---|
| **Ядро Вики и Лор** | Полный доступ (сущности, связи, граф, календарь, таймлайны) | Полный доступ | Полный доступ |
| **Редактор рукописи** | Word-Vibe, Tiptap, пагинация, стили, экспорт DOCX | Полный доступ | Полный доступ |
| **Локальная БД (SurrealDB)** | Чистая реляционно-документная база | База + таблицы чатов и сессий | База + чаты + **HNSW векторные индексы (768d)** |
| **WoWiLon AI Ассистент** | ❌ Вырезан из бандла (0 KB) | 🟢 Облачные API (OpenAI, Claude, DeepSeek, OpenRouter) | 🟢 Облачные API + локальная `llama.cpp` |
| **Поиск по лору** | Точные совпадения и фильтры | **BM25** полнотекстовый поиск + `((Сущности))` | **Гибридный RAG**: BM25 + **Векторный HNSW** |
| **Deep Research (Веб)** | ❌ Отключен | 🟢 DuckDuckGo, парсинг, цитаты `[1]` | 🟢 DuckDuckGo, парсинг, цитаты `[1]` |
| **Работа офлайн** | 100% Офлайн | Офлайн (без AI) | **100% Офлайн со всеми AI-функциями** |

---

## 🎨 2. Архитектура Фронтенда (Tree-Shaking и Изоляция UI)

В редакции **Base** исходный код AI-модулей не должен попадать в продакшен-бандл.

### 2.1. Режимы сборки (Vite Modes)
В `package.json` объявляются отдельные команды сборки:
```json
{
  "scripts": {
    "build:base":  "vite build --mode base",
    "build:pro":   "vite build --mode pro",
    "build:ultra": "vite build --mode ultra"
  }
}
```

### 2.2. Dead Code Elimination (DCE)
Импорт компонентов AI выполняется через динамические импорты с проверкой флага окружения `import.meta.env.VITE_APP_EDITION`:

```ts
import { defineAsyncComponent } from 'vue';

// При сборке 'build:base' условие статически вычисляется в false,
// и Rollup/Vite полностью вырезает папку features/ai из итоговых .js файлов
export const WowilonPanel = import.meta.env.VITE_APP_EDITION !== 'base'
  ? defineAsyncComponent(() => import('@/ts/features/ai/WowilonPanel.vue'))
  : null;
```

---

## 🦀 3. Архитектура Бэкенда (Rust Cargo Features)

В `src-tauri/Cargo.toml` разделение контролируется feature-флагами:

```toml
[features]
default = ["ai-cloud", "ai-local"]

# Редакция Base: сборка без фичей (--no-default-features)
# Редакция Pro: сборка с облачным AI
ai-cloud = ["dep:claw_runtime", "dep:claw_api"]

# Редакция Ultra: облачный AI + локальный движок llama.cpp
ai-local = ["ai-cloud", "dep:llama-sys"]
```

---

## 🗄️ 4. Модульная Архитектура Схемы SurrealDB

Вместо монолитного файла DDL схема разделяется на 3 последовательных слоя в каталоге `src/logic/schema/`:

```
src/logic/schema/
├── 01_core.surql          # Ядро: проекты, главы, сущности, связи, календарь, настройки
├── 02_ai_cloud.surql      # AI Облако: чаты, навыки, веб-страницы, доказательства, BM25, кастомные функции
└── 03_ai_vectors.surql    # AI Векторы: тяжелые HNSW индексы (768d) для эмбеддингов
```

### 4.1. Содержимое файлов схемы

#### 📄 `01_core.surql` (Выполняется во ВСЕХ версиях):
- Таблицы: `projects`, `chapters`, `entities`, `entity_types`, `relations`, `calendar_events`, `app_settings`.
- Базовые индексы по `id`, `project_id`, `created_at`.
- Системные функции валидации текста и дат.

#### 📄 `02_ai_cloud.surql` (Выполняется в `Pro` и `Ultra`):
- Таблицы: `chat_messages`, `chat_sessions`, `ai_skills`, `ai_permissions`, `web_pages`, `web_evidence`, `research_sessions`.
- Легковесные BM25 индексы: `idx_chat_msg_content_bm25`, `idx_entities_name_bm25`.
- Кастомные функции: `fn::upsert_global_web_page`, `fn::resolve_entity_mentions`.

#### 📄 `03_ai_vectors.surql` (Выполняется ТОЛЬКО в `Ultra`):
- Векторные поля: `DEFINE FIELD OVERWRITE embedding ON entity_chunks TYPE option<array<float, 768>>`.
- Векторные HNSW индексы: 
  ```surrealql
  DEFINE INDEX OVERWRITE idx_entity_chunks_emb ON entity_chunks 
      FIELDS embedding 
      TYPE HNSW 
      DIMENSION 768 
      DIST COSINE;
  ```

---

## ⚡ 5. Правила и Стандарты Использования `OVERWRITE` в SurrealQL

Для обеспечения **100% идемпотентности** (возможности повторного безопасного наката схемы при старте приложения без ошибок «resource already exists»), **ВСЕ** DDL-инструкции обязаны использовать ключевое слово `OVERWRITE`.

### 5.1. Канонические шаблоны `OVERWRITE`:

#### 1. Объявление таблиц:
```surrealql
-- ПРАВИЛЬНО:
DEFINE TABLE OVERWRITE entities SCHEMAFULL;

-- НЕПРАВИЛЬНО (упадет при повторном запуске):
DEFINE TABLE entities SCHEMAFULL;
```

#### 2. Объявление полей:
```surrealql
-- ПРАВИЛЬНО:
DEFINE FIELD OVERWRITE name ON entities TYPE string;
DEFINE FIELD OVERWRITE tags ON entities TYPE array<string> DEFAULT [];

-- НЕПРАВИЛЬНО:
DEFINE FIELD name ON entities TYPE string;
```

#### 3. Объявление индексов:
```surrealql
-- ПРАВИЛЬНО:
DEFINE INDEX OVERWRITE idx_entities_project ON entities FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chat_msg_bm25 ON chat_messages FIELDS content SEARCH ANALYZER standard BM25;

-- НЕПРАВИЛЬНО:
DEFINE INDEX idx_entities_project ON entities FIELDS project_id;
```

#### 4. Объявление кастомных функций:
```surrealql
-- ПРАВИЛЬНО:
DEFINE FUNCTION OVERWRITE fn::upsert_global_web_page(
    $url: string,
    $canonical_url: string,
    $ttl_days: int
) {
    -- тело функции
};

-- НЕПРАВИЛЬНО:
DEFINE FUNCTION fn::upsert_global_web_page(...) { ... };
```

---

## 🔄 6. Стратегия Миграций и Совместимости Данных

1. **Апгрейд (Base ➔ Pro ➔ Ultra)**:
   - Пользователь активирует Pro/Ultra.
   - Приложение выполняет недостающие `.surql` файлы (`02_ai_cloud.surql` / `03_ai_vectors.surql`).
   - SurrealDB автоматически создает новые таблицы и строит индексы по уже существующим данным без перезаписи данных.

2. **Даунгрейд / Открытие проекта Ultra в редакции Base**:
   - Редакция Base читает только таблицы ядра (`01_core.surql`).
   - Наличие в базе таблиц `chat_messages` или векторных полей `embedding` никак не блокирует чтение сущностей и глав рукописи.
   - База данных остается полностью валидной и не повреждается.
