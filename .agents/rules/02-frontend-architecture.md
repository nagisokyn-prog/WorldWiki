# 🏛️ ПРАВИЛО 02: АРХИТЕКТУРА ФРОНТЕНДА (VUE 3 / PINIA / AST)

> **ОБЛАСТЬ ДЕЙСТВИЯ**: `apps/spa`, `packages/components`, `packages/word-vibe`.
> **СТАТУС**: КРИТИЧЕСКИЙ (Zero God-Objects).

---

## 1. Каноническая 4-файловая анатомия фичи

Каждый компонент или экран оформляется **СТРОГО** в виде изолированного каталога:

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

---

## 2. Жесткие ограничения для `.vue` файлов

1. **Лимит строк в `<script setup>`**:
   * Максимум **15–30 чистых строк**.
   * Разрешён **только связующий клей** (`Glue Code`):
     ```vue
     <script setup lang="ts">
     import type { MyFeatureProps, MyFeatureEmits } from './MyFeature.model';
     import { useMyFeature } from './useMyFeature';

     const props = defineProps<MyFeatureProps>();
     const emit = defineEmits<MyFeatureEmits>();

     const { items, isLoading, selectedId, handleSelect, handleRefresh } = useMyFeature(props, emit);
     </script>
     ```
2. **Запрет сырого состояния в `.vue`**:
   * Никаких `ref()`, `reactive()`, `computed()` бизнес-логики прямо в `<script setup>`.
   * Никаких вызовов Store-методов, API-клиентов или Tauri IPC из шаблона.
3. **Запрет объявления типов в `.vue`**:
   * Все `interface`, `type`, `enum` выносятся в `<Component>.model.ts` или `<Component>.types.ts`.

---

## 3. Линейная цепочка данных (Layer Isolation)

Компоненты никогда не делают прямых обращений к базам данных или Tauri IPC. Цепочка всегда строго линейная:

$$\text{Шаблон (.vue)} \longrightarrow \text{Хук (use*.ts)} \longrightarrow \text{Store (Pinia) / Service} \longrightarrow \text{API Client (api.client.ts)} \longrightarrow \text{Tauri IPC (Rust)}$$

---

## 4. Semantic AST как Единый Источник Правды

1. Все редакторы рукописи и документов обмениваются текстом **исключительно** через типизированный `SemanticDocument` DTO (`apps/spa/src/ts/services/document/ast/ASTAdapter.ts`).
2. Запрещено передавать сырой ProseMirror/Tiptap JSON напрямую между несовместимыми модулями.
