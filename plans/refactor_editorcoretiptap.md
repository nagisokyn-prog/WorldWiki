# План: Component-Behind для EditorCoreTiptap.vue

**Оценка:** ~30 мин

## Текущее состояние
- `apps/spa/src/ts/components/Vue/Chapters/EditorCoreTiptap.vue` — ~992 строки (монолит: тулбар + bubble menu + редактор + логика)
- `apps/spa/src/ts/composables/useTiptapEditor.ts` — уже существует, но НЕ используется в `EditorCoreTiptap.vue`

## Шаги

### 1. Создать папку фичи
```
apps/spa/src/ts/features/chapters/EditorCoreTiptap/
├─ EditorCoreTiptap.vue        # тонкий .vue (только template + bindings)
├─ useTiptapEditor.ts          # перенести из composables
├─ EditorToolbar.vue           # вынести тулбар (кнопки жирный/курсив/заголовки/таблицы)
├─ EditorBubbleMenu.vue        # вынести bubble-меню (появляется при выделении текста)
├─ EditorCoreTiptap.model.ts   # типы: EditorMode, ToolbarAction, BubbleMenuItem
└─ EditorCoreTiptap.style.css  # scoped-стили
```

### 2. Выделить `EditorToolbar.vue`
- Перенести `<div class="editor-toolbar">` из `EditorCoreTiptap.vue` в отдельный компонент
- Пропсы: `editor`, `mode`, `isSaving`
- События: `@save`, `@mode-change`

### 3. Выделить `EditorBubbleMenu.vue`
- Перенести `<div class="bubble-menu">` из `EditorCoreTiptap.vue`
- Пропсы: `editor`
- Использует `tippy.js` или `@tiptap/extension-bubble-menu`

### 4. Адаптировать `useTiptapEditor.ts`
- Расширить: добавить логику из `<script setup>` `EditorCoreTiptap.vue`
- Экспортировать: `editor`, `mode`, `isSaving`, `save`, `toggleBold`, `toggleItalic`, `toggleHeading` и т.д.

### 5. Переписать `EditorCoreTiptap.vue`
- Удалить `<script setup>` — заменить на `import { useTiptapEditor } from './useTiptapEditor'`
- Только `<template>`: `<EditorToolbar>` + `<EditorBubbleMenu>` + `<editor-content>`
- `import './EditorCoreTiptap.style.css'`

### 6. Удалить старые файлы
- Удалить `apps/spa/src/ts/components/Vue/Chapters/EditorCoreTiptap.vue`
- Удалить `apps/spa/src/ts/composables/useTiptapEditor.ts`
- Поправить импорт в `app.ts`

### 7. Проверить
- `npx vue-tsc --noEmit` → ошибок нет
- загрузить app.html → открыть главу → тулбар и bubble menu работают