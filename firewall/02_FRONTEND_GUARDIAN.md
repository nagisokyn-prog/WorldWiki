# 🎨 02. АРХИТЕКТУРА ФРОНТЕНД-АНАЛИЗАТОРА `sfc-guardian`

> **Назначение**: Высокоскоростной статический анализатор Vue 3 Single File Components (SFC), TypeScript и CSS на базе AST (`oxc_parser` / `@vue/compiler-sfc`) и `lightningcss`.

---

## 1. Единый Контракт `Violation` (TypeScript)

Формат полностью синхронизирован со структурой в Rust и читает определения из `firewall/rules.json`:

```typescript
export type Category = "Architecture" | "Security" | "Robustness" | "Convention";
export type Severity = "Deny" | "Warn";

export interface Violation {
  ruleId: string;               // "VUE-001", "CSS-001", "LEAK-001"
  ruleVersion: string;          // "1.0"
  category: Category;
  severity: Severity;
  file: string;                 // "apps/spa/src/ts/features/..."
  line: number;
  column: number;
  symbol: string;               // Имя компонента / функции
  snippet: string;
  message: string;
  remediation: string;          // "💡 Рецепт решения"
  fingerprint: string;          // SHA-256 устойчивый хэш
}
```

---

## 2. 🏛️ Четыре Железных Закона CSS (Zero-CSS Chaos & Bloat)

### 2.1. `CSS-001`: Полный Запрет Сырого CSS в `.vue` Файлах
* Запрещены простыни стилей в `<style>` внутри SFC.
* Все стили экранов и фичей выносятся в `@worldwiki/resources/src/styles/...`.
* В `.vue` разрешен **строго внешний импорт**:
  ```html
  <style scoped src="@worldwiki/resources/src/styles/features/timeline/CalendarSettings.css"></style>
  ```
* *Исключение*: локальный блок `<style scoped>` не более **15 строк** для сугубо локального микро-позиционирования.

### 2.2. `CSS-002`: Зеркальная Структура Файлов (Zero Misplaced Stylesheets)
* Структура файлов в `@worldwiki/resources/src/styles/` обязана строго зеркалировать дерево компонентов:
  ```text
  apps/spa/src/ts/features/ai/AiCitationBadge.vue
                         ↕ (зеркальное соответствие)
  packages/resources/src/styles/features/ai/AiCitationBadge.css
  ```
* Если файл CSS лежит вне зеркальной таксономии (`styles/tokens/`, `styles/components/`, `styles/features/`) — фаервол блокирует сборку: `[CSS-002] Orphan or misplaced stylesheet`.

### 2.3. `CSS-003`: Детектор Дублирования CSS-Правил (`lightningcss` AST)
* Анализатор строит хэш-таблицу декларативных блоков свойств.
* Если **3+ селектора в разных файлах** объявляют идентичный набор свойств (например, повторяющийся стек backdrop-filter + border + border-radius), выдается предупреждение:
  ```text
  ⚠️ [CSS-003] Duplicate CSS Declaration Block:
     Found identical rule set across 3 stylesheets:
     ↳ styles/features/ai/AiCitationBadge.css
     ↳ styles/features/ai/AiQuoteReplyBanner.css
     ↳ styles/features/ai/AiToolInspector.css
     💡 Remediation: Extract into a shared class in @worldwiki/resources/base.
  ```

### 2.4. `CSS-004`: Абсолютный Запрет Хардкода Значений (Design Token Enforcer)
* Запрещены:
  * `#hex` цвета (`#fff`, `#1a1a1a`);
  * Прямые вызовы `rgb()`, `rgba()`, `hsl()`;
  * Именованные HTML-цвета (`red`, `black`, `white`);
  * Захардкоженные радиусы `border-radius: 8px` (только `var(--border-radius-md)`);
  * Инлайн-стили с цветами `<div style="color: ...">`.

---

## 3. Правила Чистоты Компонентов Vue 3

### 3.1. `VUE-001`: Чистота `<script setup>` (Анти-Монолит)
* **Запрещено**: Сырые `ref()`, `reactive()`, `computed()`, сложные функции или вызовы Store/API внутри `<script setup>`.
* **Лимит**: Максимум **15–30 чистых строк** связующего клея (Glue Code: `defineProps`, `defineEmits`, вызов `useMyFeature()`).
* **Обязательные компаньоны**: Рядом с каждым компонентом обязан лежать файл хука `use<Component>.ts` и его типы `<Component>.model.ts`.

### 3.2. `VUE-002`: Запрет Прямого Tauri IPC в Компонентах
* Запрещен импорт `@tauri-apps/api/*`, `invoke()`, `listen()` в разметке и шаблонах.
* Цепочка данных: `SFC -> use*.ts -> Store -> API Client -> Tauri`.

### 3.3. `LEAK-001`: Симметричная Очистка Слушателей (Zero Memory Leaks)
* Если в `useFeature.ts` вызываются `listen()`, `addEventListener()`, `setInterval()`, анализатор в AST проверяет наличие соответствующего вызова очистки в `onUnmounted(() => { ... })`.
* Если очистка отсутствует — генерируется ошибка `[LEAK-001] Resource listener without symmetric onUnmounted cleanup`.

---

## 4. Обработка Ошибок Парсинга во Фронтенде

* Если `oxc-parser` встречает невалидный синтаксис в процессе набора кода:
  1. Выводится `[PARSE-ERROR] <file>: <error>`;
  2. Файл исключается из проверки без падения процесса;
  3. Если повреждено $> 5\%$ файлов проекта $\implies$ `Exit 1`.
