# 🏛️ Архитектура Продуктовых Редакций (Base и Ultra) и Модульной Схемы SurrealDB

В данном документе описана архитектура разделения приложения **WorldWiki** на две продуктовые редакции (**Base** и **Ultra**), включая изоляцию фронтенд-бандлов, компиляцию Rust-бэкенда, модульное разбиение DDL-схемы SurrealDB на независимые `.surql` файлы и правила бесшовного апгрейда.

---

## 📊 1. Матрица Редакций и Возможностей (Base vs Ultra)

| Возможность / Слой | 🟢 Base (Базовый / Писательский) | 🟣 Ultra (Максимальный с ИИ) |
|---|---|---|
| **Ядро Вики и Лор** | Полный доступ (сущности, связи, граф, календари, таймлайн, онтология) | Полный доступ |
| **Редактор рукописи** | Word-Vibe, Tiptap, пагинация, стили, экспорт DOCX | Полный доступ |
| **Локальная БД (SurrealDB)** | Реляционно-документная база (`01_core.surql`) | База + ИИ-таблицы + **HNSW векторные индексы** + Функции |
| **WoWiLon AI Ассистент** | ❌ Вырезан из бандла (0 KB) | 🟢 **Гибридный ИИ**: Облачные API (OpenAI, Claude, DeepSeek, OpenRouter) + локальная `llama.cpp` |
| **Поиск по лору** | Точные совпадения, морфология, фильтры | **Гибридный RAG**: BM25 + **Векторный HNSW** + `fn::gather_rag_bundle` |
| **Deep Research (Веб)** | ❌ Отключен | 🟢 DuckDuckGo / SearXNG, парсинг, база фактов `web_evidence` |
| **Библиотека навыков** | ❌ Отключена | 🟢 Автоподбор скиллов, `fn::resolve_auto_skills`, кастомные промпты |
| **Работа офлайн** | 100% Офлайн | **100% Офлайн с локальными LLM и эмбеддингами** |

---

## 🎨 2. Архитектура Фронтенда (Vite Modes & Dead Code Elimination)

В редакции **Base** исходный код AI-модулей полностью исключается из продакшен-бандла.

### 2.1. Режимы сборки (Vite Modes)
В `package.json`:
```json
{
  "scripts": {
    "build:base":  "vite build --mode base",
    "build:ultra": "vite build --mode ultra"
  }
}
```

### 2.2. Dead Code Elimination (DCE)
Импорт компонентов ИИ выполняется через динамические импорты с проверкой флага окружения `import.meta.env.VITE_APP_EDITION`:

```ts
import { defineAsyncComponent } from 'vue';

// При сборке 'build:base' условие статически вычисляется в false,
// и Rollup/Vite полностью вырезает папку features/ai из итоговых .js файлов
export const WowilonPanel = import.meta.env.VITE_APP_EDITION === 'ultra'
  ? defineAsyncComponent(() => import('@/ts/features/ai/WowilonPanel.vue'))
  : null;
```

---

## 🦀 3. Архитектура Бэкенда (Rust Cargo Features)

В `src-tauri/Cargo.toml` разделение контролируется feature-флагами:

```toml
[features]
default = ["ai-full"]

# Редакция Base: чистая сборка без ИИ зависимостей (--no-default-features)
# Редакция Ultra: облачный AI + локальный движок llama.cpp + векторные зависимости
ai-full = ["dep:claw_runtime", "dep:claw_api", "dep:llama-sys", "dep:fastembed"]
```

---

## 🗄️ 4. Модульная Архитектура Схемы SurrealDB (`src/logic/schema/`)

Монолитный файл `surreal_schema.surql` разделяется на изолированные предметные DDL-файлы:

```
apps/spa/src/logic/schema/
├── 01_core.surql                 # Базовое ядро: проекты, тома, арки, главы, текст, сущности, таймлайн, планы
├── 02_ai_workspace.surql         # ИИ-пространство: ai_profiles, ai_modes, chats, chat_messages, agent_memory, artifacts, ai_skills
├── 03_web_research.surql         # Веб-исследования: web_pages, web_evidence, research_sessions
├── 04_embeddings_hnsw.surql      # Векторные HNSW индексы и чанки: entity_chunks, эмбеддинги глав и сообщений
└── 05_functions.surql            # Аналитические функции: fn::gather_rag_bundle, fn::resolve_auto_skills, fn::upsert_global_web_page
```

### 4.1. Карта выполнения по редакциям

| Файл схемы | 🟢 Редакция Base | 🟣 Редакция Ultra | Назначение |
|---|:---:|:---:|---|
| **`01_core.surql`** | ✅ Выполняется | ✅ Выполняется | Рукопись, лор, онтология, таймлайн, `cascade_project_delete` |
| **`02_ai_workspace.surql`** | ❌ Пропускается | ✅ Выполняется | Профили моделей, ключи, чаты, память, навыки |
| **`03_web_research.surql`** | ❌ Пропускается | ✅ Выполняется | Кэш страниц и постоянная база веб-доказательств |
| **`04_embeddings_hnsw.surql`** | ❌ Пропускается | ✅ Выполняется | Тяжелые HNSW векторные индексы (1536d / 2048d / 1024d) |
| **`05_functions.surql`** | ❌ Пропускается | ✅ Выполняется | Хранимые функции для GraphRAG и гибридного скоринга |

---

## 🔄 5. Гарантия Совместимости и Бесшовного Апгрейда (Base ➔ Ultra)

1. **Апгрейд (Base ➔ Ultra)**:
   * Пользователь переходит на редакцию Ultra.
   * При первом запуске бэкенд последовательно выполняет недостающие модули (`02_ai_workspace.surql` ➔ `03_web_research.surql` ➔ `04_embeddings_hnsw.surql` ➔ `05_functions.surql`).
   * Благодаря `OVERWRITE` существующие данные рукописи, персонажей и глав **не затрагиваются**, а новые таблицы и индексы мгновенно становятся активными.

2. **Даунгрейд / Открытие базы Ultra в редакции Base**:
   * Редакция Base обращается только к таблицам ядра (`01_core.surql`).
   * Наличие в базе таблиц `ai_profiles`, `web_evidence` или `chats` никак не мешает работе Base: база данных остается 100% валидной.

---

## ⚡ 6. Стандарты Идемпотентности (`OVERWRITE`)

Для гарантии безопасного наката при старте приложения:
* Все таблицы объявляются как `DEFINE TABLE OVERWRITE <name> SCHEMAFULL;`
* Все поля объявляются как `DEFINE FIELD OVERWRITE <name> ON <table> TYPE ...;`
* Все индексы объявляются как `DEFINE INDEX OVERWRITE <name> ON <table> ...;`
* Все события объявляются как `DEFINE EVENT OVERWRITE <name> ON TABLE <table> ...;`
* Все функции объявляются как `DEFINE FUNCTION OVERWRITE fn::<name>(...) { ... };`
