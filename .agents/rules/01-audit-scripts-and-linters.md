---
trigger: always_on
---

# 🛑 ПРАВИЛО 01: АВТОМАТИЗИРОВАННЫЕ СКРИПТЫ-ИНКВИЗИТОРЫ И ЛИНТЕРЫ

> **ОБЛАСТЬ ДЕЙСТВИЯ**: Все файлы монорепозитория (`apps/spa`, `packages/*`, `src-tauri`).
> **СТАТУС**: КРИТИЧЕСКИЙ (Блокирует коммит и сдачу задачи).

---

## 1. Реестр Скриптов-Аудиторов

Каждый ИИ-агент перед рапортом пользователю обязан убедиться, что его код проходит проверки следующими скриптами:

### 1.1. `node analyze_vue_monoliths.js` (Аудит монолитов и чистоты Vue SFC)

- 🔴 **CRITICAL ERROR: Тяжелая логика в `<script setup>`**
  - Запрещено объявлять в `<script setup>` сырые `ref()`, `reactive()`, `computed()`, сложные функции или методы вызова API/Store.
  - **Порог**: не более **15-30 чистых строк** связующего клея (Glue Code: импорт хука `const { ... } = useFeature()`, проброс `props` и `emit`).
- 🔴 **ERROR: Отсутствие хука-компаньона `use<Component>.ts`**
  - Любой нетривиальный компонент **ОБЯЗАН** иметь рядом файл бизнес-логики `use<Component>.ts` (или в папке `hooks/`).
- 🔴 **ERROR: Объявление типов внутри `.vue`**
  - Все `interface Props`, `interface Emits`, DTO и сложные структуры данных выносятся в `<Component>.model.ts` или `<Component>.types.ts`.

---

### 1.2. `node find_css_hardcode.js` & `node deep_css_inspector.js` (Охотники за хардкодом CSS)

- 🔴 **ERROR: Прямые Hex-цвета** (`#fff`, `#000000`, `#3b82f6`, `#0f1218` и любые `#RRGGBB` / `#RGB`).
- 🔴 **ERROR: Именованные HTML-цвета** (`color: red`, `background: black`, `white`, `blue`, `gray`).
- 🔴 **ERROR: Прямые RGB/RGBA/HSL вызовы** (`rgba(0, 0, 0, 0.5)`, `rgba(255, 255, 255, 0.1)`).
- 🔴 **ERROR: Захардкоженные радиусы скругления** (`border-radius: 8px`, `border-radius: 4px`).
- 🔴 **ERROR: Инлайн-стили с цветами** (`<div style="color: #fff; background: ...">`).
- ✅ **ЕДИНСТВЕННОЕ РАЗРЕШЕННОЕ РЕШЕНИЕ**: Использовать **СТРОГО** дизайн-токены:
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

- 🔴 **CRITICAL ERROR: Клонирование базового UI в `apps/spa`**
  - Запрещено писать свои кнопки, диалоги (`AppDialog`), тулбары, инпуты, теги (`TagsField`), переключатели тем, колёса прокрутки (`XboxWheel`), деревья (`ExplorerTree`) и вкладки внутри `apps/spa`.
  - **Правило**: Все базовые UI-элементы берутся **СТРОГО** из `@worldwiki/components`. Если компонента не хватает — он создается в `packages/components`, экспортируется в `src/index.ts` и только затем импортируется в `apps/spa`.

---

### 1.4. `node analyze_css_bloat.js` & `node analyze_css.js` (Контроль раздувания стилей)

- 🔴 **ERROR: Простыни стилей в `<style>`**: Запрещены блоки `<style>` более 50-70 строк. Стили обязаны декомпозироваться вместе с атомарными подкомпонентами.
- 🔴 **ERROR: Запрет TailwindCSS**: Только чистый **Scoped Vanilla CSS** с CSS Custom Properties дизайн-системы.

---

### 1.5. `node scripts/verify_codebase_integrity.js` & `npx knip` (Аудит мертвого кода и экспортов)

- 🔴 **ERROR: Дубликаты экспортов** (например, одновременный `export const x` и `export default x`).
- 🔴 **ERROR: Мертвые неиспользуемые файлы / брошенные ветки**.
- 🔴 **ERROR: Неразрешенные импорты и сломанные алиасы**.

---

### 1.6. `pnpm typecheck` & `cargo check` (Бескомпромиссная проверка типов)

- 🔴 **ERROR: Любое использование `any`** (`strict: true`, `noImplicitAny: true`).
- 🔴 **ERROR: Использование `// @ts-ignore` или `// @ts-nocheck`** без железобетонного объяснения архитектурной невозможности типизации сторонней библиотеки.
- 🔴 **ERROR: Ошибки типизации шаблонов `.vue` файлов** (`vue-tsc -b`).
- 🔴 **ERROR: Ошибки компиляции Rust** (`cargo check --all-targets`).
