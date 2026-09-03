# ⚠️ СТРОГИЙ СТАНДАРТ РАЗРАБОТКИ И ИНЖЕНЕРНЫЙ МАНИФЕСТ ДЛЯ ИИ-АГЕНТОВ (AGENTS.MD)

> **КРИТИЧЕСКИЙ УРОВЕНЬ ТРЕБОВАНИЙ ДЛЯ ВСЕХ ИИ-АГЕНТОВ**: Этот репозиторий находится под **непрерывным автоматическим аудитом качества кода и архитектуры как на ФРОНТЕНДЕ, так и на БЭКЕНДЕ**. Любая попытка написать «быстрый костыль», создать божественный монолитный `.vue` файл, захардкодить hex-цвет, использовать `any`, пропустить написание юнит-тестов, нарушить границы пакетов или протащить `tauri::*` внутрь домена **приведет к немедленному падению аудиторских скриптов в CI/локальном окружении и отмене изменений**.

---

## 🛑 1. АВТОМАТИЗИРОВАННЫЕ СКРИПТЫ-ИНКВИЗИТОРЫ: ЧТО И КАК ОНИ ЛОВЯТ

Каждый агент перед сдачей задачи обязан знать точные правила и триггеры ошибок локальных скриптов-аудиторов:

### 1.1. `node analyze_vue_monoliths.js` (Аудит монолитов и чистоты Vue SFC)
* 🔴 **CRITICAL ERROR: Тяжелая логика в `<script setup>`**
  * Запрещено объявлять в `<script setup>` сырые `ref()`, `reactive()`, `computed()`, сложные функции или методы вызова API/Store.
  * **Порог**: не более **15-30 чистых строк** связующего клея (Glue Code: импорт хука `const { ... } = useFeature()`, проброс `props` и `emit`).
* 🔴 **ERROR: Отсутствие хука-компаньона `use<Component>.ts`**
  * Любой нетривиальный компонент **ОБЯЗАН** иметь рядом файл бизнес-логики `use<Component>.ts` (или в папке `hooks/`).
* 🔴 **ERROR: Объявление типов внутри `.vue`**
  * Все `interface Props`, `interface Emits`, DTO и сложные структуры данных выносятся в `<Component>.model.ts` или `<Component>.types.ts`.

---

### 1.2. `node find_css_hardcode.js` & `node deep_css_inspector.js` (Охотники за хардкодом CSS)
* 🔴 **ERROR: Прямые Hex-цвета** (`#fff`, `#000000`, `#3b82f6`, `#0f1218` и любые `#RRGGBB` / `#RGB`).
* 🔴 **ERROR: Именованные HTML-цвета** (`color: red`, `background: black`, `white`, `blue`, `gray`).
* 🔴 **ERROR: Прямые RGB/RGBA/HSL вызовы** (`rgba(0, 0, 0, 0.5)`, `rgba(255, 255, 255, 0.1)`).
* 🔴 **ERROR: Захардкоженные радиусы скругления** (`border-radius: 8px`, `border-radius: 4px`).
* 🔴 **ERROR: Инлайн-стили с цветами** (`<div style="color: #fff; background: ...">`).
* ✅ **ЕДИНСТВЕННОЕ РАЗРЕШЕННОЕ РЕШЕНИЕ**: Использовать **СТРОГО** дизайн-токены:
  ```css
  /* ПРАВИЛЬНО: */
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  border-radius: var(--border-radius-md);
  transition: all var(--transition-normal);
  ```

---

### 1.3. `node check_components_duplicates.js` (Детектор дублирования UI-компонентов)
* 🔴 **CRITICAL ERROR: Клонирование базового UI в `apps/spa`**
  * Запрещено писать свои кнопки, диалоги (`AppDialog`), тулбары, инпуты, теги (`TagsField`), переключатели тем, колёса прокрутки (`XboxWheel`), деревья (`ExplorerTree`) и вкладки внутри `apps/spa`.
  * **Правило**: Все базовые UI-элементы берутся **СТРОГО** из `@worldwiki/components`. Если компонента не хватает — он создается в `packages/components`, экспортируется в `src/index.ts` и только затем импортируется в `apps/spa`.

---

### 1.4. `node analyze_css_bloat.js` & `node analyze_css.js` (Контроль раздувания стилей)
* 🔴 **ERROR: Простыни стилей в `<style>`**: Запрещены блоки `<style>` более 50-70 строк. Стили обязаны декомпозироваться вместе с атомарными подкомпонентами.
* 🔴 **ERROR: Запрет TailwindCSS**: Только чистый **Scoped Vanilla CSS** с CSS Custom Properties дизайн-системы.

---

### 1.5. `node scripts/verify_codebase_integrity.js` & `npx knip` (Аудит мертвого кода и экспортов)
* 🔴 **ERROR: Дубликаты экспортов** (например, одновременный `export const x` и `export default x`).
* 🔴 **ERROR: Мертвые неиспользуемые файлы / брошенные ветки**.
* 🔴 **ERROR: Неразрешенные импорты и сломанные алиасы**.

---

### 1.6. `pnpm typecheck` & `cargo check` (Бескомпромиссная проверка типов)
* 🔴 **ERROR: Любое использование `any`** (`strict: true`, `noImplicitAny: true`).
* 🔴 **ERROR: Использование `// @ts-ignore` или `// @ts-nocheck`** без железобетонного объяснения архитектурной невозможности типизации сторонней библиотеки.
* 🔴 **ERROR: Ошибки типизации шаблонов `.vue` файлов** (`vue-tsc -b`).
* 🔴 **ERROR: Ошибки компиляции Rust** (`cargo check --all-targets`).

---

## 🏛️ 2. СТАНДАРТ АРХИТЕКТУРЫ ФРОНТЕНДА (VUE 3 / PINIA / AST)

### 🧩 Каноническая анатомия любого модуля / фичи:
Каждый экран или комплексный блок разметки организуется **СТРОГО** по 4-компонентной схеме:

```
MyFeature/
├── MyFeature.vue              # 🟢 ТОЛЬКО декларативный <template> + 15 строк клея в <script setup>
├── useMyFeature.ts            # 🧠 ВСЯ бизнес-логика, ref, computed, методы, обработчики, сервисы
├── MyFeature.model.ts         # 🏷️ ТОЛЬКО TypeScript-интерфейсы Props, Emits, DTO, Enums
├── MyFeature.spec.ts          # 🧪 ОБЯЗАТЕЛЬНЫЕ Unit-тесты для useMyFeature.ts
└── components/                # 🧱 Атомарные подкомпоненты (декомпозиция верстки)
    ├── MyFeatureHeader.vue
    ├── MyFeatureList.vue
    └── MyFeatureItem.vue
```

### 🧱 Запрет смешивания слоев данных:
Прямые вызовы Tauri IPC, низкоуровневых БД или сырых REST-клиентов из шаблона `.vue` **СТРОГО ЗАПРЕЩЕНЫ**. 
Цепочка данных всегда строго однонаправленная и линейная:
$$\text{Шаблон (.vue)} \longrightarrow \text{Хук (use*.ts)} \longrightarrow \text{Store (Pinia) / Service} \longrightarrow \text{API Client (api.client.ts)} \longrightarrow \text{Tauri IPC (Rust)}$$

---

## 🦀 3. СТАНДАРТ АРХИТЕКТУРЫ БЭКЕНДА (RUST HEXAGONAL CORE: ARCH-001..ARCH-008)

Бэкенд организован по строгой **Гексагональной Архитектуре (Ports & Adapters)** с предметными контекстами:

```
src-tauri/src/
├── domain/                    # Чистые сущности, value objects, DomainError (0 внешних библиотек)
├── application/               # Use cases (GetChapter, SaveEntity, ExportDocx, etc.) + ApplicationError
├── ports/                     # Трейты репозиториев, AI, хранилищ и EventPublisherPort
├── infrastructure/            # Реализация портов: SurrealDB, llama.cpp, OpenXML DOCX, локальная FS
├── adapters/tauri/            # ⚠️ ЕДИНСТВЕННЫЙ слой, знающий о Tauri (commands.rs, bridge_macro!, IpcError)
└── bootstrap/                 # Composition Root: сборка графа зависимостей AppServices
```

| Код Инварианта | Правило Архитектуры Бэкенда (`src-tauri`) |
|---|---|
| **ARCH-001** | `worldwiki-domain` **НЕ ДОЛЖЕН** импортировать `tauri`, `surrealdb`, `reqwest`, `tokio` или другие внешние SDK. |
| **ARCH-002** | `worldwiki-application` **НЕ ДОЛЖЕН** импортировать `tauri`. Зависит только от `domain` и `ports`. |
| **ARCH-003** | `worldwiki-ports` **НЕ ДОЛЖЕН** зависеть от конкретных реализаций инфраструктуры (только чистые трейты). |
| **ARCH-004** | `worldwiki-infrastructure` **ОБЯЗАН** реализовывать трейты из `ports`, а не диктовать доменные правила. |
| **ARCH-005** | `worldwiki-tauri` — **ЕДИНСТВЕННЫЙ** слой/крейт, которому разрешено импортировать `tauri::*`. |
| **ARCH-006** | `worldwiki-application` **НЕ ДОЛЖЕН** напрямую диспатчить события во фронтенд (только через `EventPublisherPort` / `TransactionalOutbox`). |
| **ARCH-007** | Никакие типы `tauri::*` (`State`, `AppHandle`, `Window`) не могут проникать в сигнатуры `application` или `domain`. |
| **ARCH-008** | Никакие конкретные типы `infrastructure` (например, `Surreal<Db>`) не могут появляться в публичных сигнатурах Use Cases. |
| **ARCH-009** | Границы модулей Bounded Contexts изолированы: межмодульное общение только через публичные DTO. |
| **ARCH-010** | Все тяжелые асинхронные задачи (AI, Export, Embeddings) обязаны принимать `CancellationToken`. |
| **ARCH-011** | Мутирующие Use Cases обязаны быть идемпотентными по `operation_id`. |
| **ARCH-012** | AI-инструменты имеют доступ к системе **СТРОГО** через Application Use Cases (не напрямую в БД). |

---

## 🧪 4. ОБЯЗАТЕЛЬНЫЙ СТАНДАРТ ТЕСТИРОВАНИЯ (TDD / UNIT TESTS НА КАЖДЫЙ ПУТЬ)

Ни одна задача не считается выполненной, пока не написаны и не проходят автоматические тесты:

1. **Фронтенд — Тест на каждый Composable-хук**:
   * Для каждого `use<Feature>.ts` создается файл `use<Feature>.spec.ts` (или в папке `__tests__/`).
2. **Бэкенд — Тест на каждый Use Case**:
   * Для каждого сценария `application/*/*.rs` пишется чистый Unit-тест с Fake/Mock репозиторием (без поднятия Tauri).
3. **Обязательное покрытие всех путей ветвления (Branch Coverage)**:
   * **Success Path**: Штатный сценарий успешной загрузки / сохранения данных.
   * **Error & Rollback Path**: Проверка корректности отката оптимистичного состояния (Rollback) при ошибке бэкенда/сети.
   * **Edge Cases**: Пустые списки, `null`/`undefined` пропсы, превышение лимитов.
   * **Debounce & Async Cancellation**: Проверка отмены таймеров при размонтировании (`unmounted`).
4. **Команды запуска тестов**:
   ```bash
   # Тесты фронтенда (Vitest)
   pnpm --filter @worldwiki/spa test
   pnpm --filter @worldwiki/components test
   
   # Тесты бэкенда (Rust)
   cargo test --lib application
   ```

---

## 🏛️ 5. ЖЕЛЕЗНЫЕ ДОМЕННЫЕ ИНВАРИАНТЫ

1. **Триггер сущностей в тексте рукописи — СТРОГО `((Сущность))`**:
   * Никаких `@Имя`, `[[Локация]]` или `#Тег`.
2. **Золотой эталон времени — Абсолютная Минута ($M_{\text{abs}} \in \mathbb{Z}$)**:
   * Никаких `new Date()` для расчетов лора. Все летоисчисления, фазы лун и эпохи рассчитываются через `calendar.math.ts`.
3. **Semantic AST — Единый Источник Правды для Текста**:
   * Все редакторы обмениваются данными **исключительно** через типизированный `SemanticDocument` DTO (`ASTAdapter.ts`).
4. **Изоляция пакетов монорепозитория**:
   * `@worldwiki/word-vibe` работает на изолированном Tiptap v2, а `apps/spa` на Tiptap v3. Прямой импорт классов между ними запрещен.

---

## 📋 6. ЧЕКЛИСТ САМОПРОВЕРКИ ДЛЯ ИИ-АГЕНТА ПЕРЕД СДАЧЕЙ ЗАДАЧИ

Прежде чем отрапортовать пользователю о завершении работы, агент **ОБЯЗАН** выполнить самопроверку по чек-листу:

- [ ] 🧪 **Тесты**: Написаны и успешно проходят unit-тесты (`pnpm test`, `cargo test`). Покрыты сценарии успеха, ошибки и граничные случаи.
- [ ] 🔍 **TypeScript & Rust**: Выполнен `pnpm --filter @worldwiki/spa typecheck` — 0 ошибок. `cargo check` — 0 ошибок.
- [ ] 🧱 **Архитектура Фронтенда**: Во `.vue` файлах нет божественных монолитов. Логика вынесена в `use*.ts`, типы в `*.model.ts`.
- [ ] 🦀 **Архитектура Бэкенда**: В Rust соблюдены инварианты `ARCH-001..ARCH-008`. Tauri изолирован в `adapters/tauri/`.
- [ ] 🎨 **CSS & Дизайн-токены**: Нет захардкоженных цветов `#...`, `rgb()`, `hsl()` (запущен `node find_css_hardcode.js` — 0 новых долгов).
- [ ] 📦 **UI-Kit**: Использованы базовые компоненты из `@worldwiki/components`, а не созданы дубликаты в `apps/spa`.
- [ ] 🔗 **Markdown-пути**: Все ссылки в документации — **относительные** (`./path/README_*.md`), без `file:///c:/Users/...`.
- [ ] 📁 **Файловая гигиена**: Не созданы лишние дублирующие `README.md` там, где есть специализированные `README_<Dir>.md`.
