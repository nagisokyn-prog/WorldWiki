# План: Добавить dev-deps (unplugin-vue-components, unplugin-auto-import, vite-plugin-dts, pinia, @tanstack/vue-query)

**Оценка:** ~30 мин

## Текущее состояние
- Уже добавлены: `knip`, `happy-dom`
- Из плана НЕ добавлены: `unplugin-vue-components`, `unplugin-auto-import`, `vite-plugin-dts`, `pinia`, `@tanstack/vue-query`
- `vite-plugin-vue-devtools` и `vite-plugin-checker` уже включены в `apps/spa/vite.config.ts`

## Шаги

### 1. Добавить devDependencies в корневой `package.json`
```json
"devDependencies": {
  ...,
  "unplugin-auto-import": "^0.19.0",
  "unplugin-vue-components": "^0.28.0",
  "vite-plugin-dts": "^4.5.0",
  "pinia": "^3.0.0",
  "@tanstack/vue-query": "^5.60.0"
}
```

### 2. Настроить `apps/spa/vite.config.ts` — unplugin-auto-import
```ts
import AutoImport from 'unplugin-auto-import/vite';

// в plugins:
AutoImport({
  imports: ['vue', 'vue-i18n'],
  dts: 'src/ts/auto-imports.d.ts',
}),
```

### 3. Настроить `apps/spa/vite.config.ts` — unplugin-vue-components
```ts
import Components from 'unplugin-vue-components/vite';

// в plugins:
Components({
  dirs: ['src/ts/components', 'src/ts/features'],
  dts: 'src/ts/components.d.ts',
}),
```

### 4. Настроить Pinia (глобальный стор)
- Создать `apps/spa/src/ts/stores/` папку
- Создать `apps/spa/src/ts/stores/index.ts` — `createPinia()`
- В `app.ts` добавить `app.use(pinia)`
- Сейчас все composables используют `ref/shallowRef` — Pinia пока только как каркас, без миграции

### 5. Настроить @tanstack/vue-query
- Создать `apps/spa/src/ts/query-client.ts`
```ts
import { QueryClient } from '@tanstack/vue-query';
export const queryClient = new QueryClient();
```
- В `app.ts` добавить `app.use(VueQueryPlugin, { queryClient })`
- Пока не менять существующие API-вызовы — только каркас

### 6. Проверить
- `pnpm install` → успешно
- `npx vue-tsc --noEmit` → 0 ошибок (auto-imports.d.ts и components.d.ts не конфликтуют)
- `npx vite build` в apps/spa → собирается без ошибок