# План: Component-Behind для EntityEditor.vue

**Оценка:** ~30 мин

## Текущее состояние
- `apps/spa/src/ts/components/Vue/SchemaEditor/EntityEditor.vue` — 381 строка (монолит: шаблон + логика в `<script setup>`)
- `apps/spa/src/ts/composables/useEntityEditor.ts` — уже существует, но НЕ используется в `EntityEditor.vue`
- `apps/spa/src/ts/composables/useEntityOps.ts` — wrapper для app-shell

## Шаги

### 1. Создать папку фичи
```
apps/spa/src/ts/features/entities/EntityEditor/
├─ EntityEditor.vue            # тонкий .vue (только template + bindings)
├─ useEntityEditor.ts          # перенести из composables
├─ EntityEditor.model.ts       # типы: Section, Field, DynamicContainer, SchemaConfig
└─ EntityEditor.style.css      # scoped-стили из компонента
```

### 2. Перенести типы в `.model.ts`
- `interface Section`, `Field`, `DynamicContainer`, `SchemaConfig` — вынести из `EntityEditor.vue`
- `interface EntityEditorState` — состояние редактора (formData, loading, activeSection и т.д.)

### 3. Адаптировать `useEntityEditor.ts`
- Переименовать/расширить `useEntityEditor(props: { entityType, entityId, projectName })`
- Перенести логику из `<script setup>` `EntityEditor.vue` в composable
- Экспортировать реактивное состояние и методы

### 4. Переписать `EntityEditor.vue`
- Удалить `<script setup>` — заменить на `import { useEntityEditor } from './useEntityEditor'`
- Только `<template>` с биндингами на `state.*` и вызовами `methods.*`
- `import './EntityEditor.style.css'`

### 5. Удалить старый файл
- Удалить `apps/spa/src/ts/components/Vue/SchemaEditor/EntityEditor.vue`
- Удалить `apps/spa/src/ts/composables/useEntityEditor.ts` (перенесён в features)
- Поправить импорт в `app.ts` (если есть defineAsyncComponent на старый путь)

### 6. Проверить
- `npx vue-tsc --noEmit` → ошибок нет
- загрузить app.html → EntityEditor открывается, поля рендерятся