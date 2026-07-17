# План: Library build для packages/components и packages/resources

**Оценка:** ~1 час

## Текущее состояние
- `packages/components/src/index.ts` — публичный API библиотеки
- `packages/resources/src/index.ts` — экспорт стилей
- Импорт в SPA: через alias `@worldwiki/components` → `packages/components/src` напрямую (dev-режим)
- **НЕТ** library build: нет `vite-plugin-dts`, нет `.d.ts` файлов при сборке, нет ESM-сборки
- TypeScript при импорте из пакетов НЕ видит типы, только интуитивно через IDE

## Целевое состояние
- `packages/components` и `packages/resources` собираются как ESM-библиотеки
- Генерируются `.d.ts` через `vite-plugin-dts`
- SPA импортирует из собранного `dist/` (или через package.json exports)

## Шаги

### 1. Настроить `packages/components/vite.config.ts`
Заменить текущий dev-конфиг на library build:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({ rollupTypes: true }),  // генерирует .d.ts
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WorldWikiComponents',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue', 'vue-i18n', '@vueuse/motion', '@formkit/auto-animate'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
    outDir: 'dist',
  },
});
```

### 2. Настроить `packages/resources/vite.config.ts`
Аналогично, но без `vue()` (чистые ресурсы):

```ts
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WorldWikiResources',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],  // никаких зависимостей — чистые стили/ассеты
    },
    outDir: 'dist',
  },
});
```

### 3. Обновить `package.json` обоих пакетов
**`packages/components/package.json`:**
```json
{
  "name": "@worldwiki/components",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  }
}
```

**`packages/resources/package.json`:**
```json
{
  "name": "@worldwiki/resources",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  }
}
```

### 4. Добавить билд-зависимости
В корень `package.json` (root) добавить:
```
"@vitejs/plugin-vue": "^6.0.7",   // уже есть
"vite-plugin-dts": "^4.5.0",
"vue": "^3.5.39",                  // уже есть, но нужен как peer для components
```

Либо добавить отдельно в `packages/components/package.json` как devDeps.

### 5. Обновить alias в SPA (для dev-режима)
В `apps/spa/vite.config.ts` оставить alias для dev, но добавить conditional resolve:
- `@worldwiki/components` → `../../packages/components/dist/index.js` если билд, иначе `../../packages/components/src`
- Пока оставить alias на `src/` для dev — после сборки пакетов переключить.

### 6. Добавить build в turbo.json
```json
"packages/components": {
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
},
"packages/resources": {
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
},
```

### 7. Проверить
- `pnpm build` → собирает оба пакета (dist/index.js + dist/index.d.ts)
- `apps/spa` собирается с новыми типами
- `npx vue-tsc --noEmit` → 0 ошибок