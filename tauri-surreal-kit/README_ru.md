# tauri-surreal-kit

**Фреймворк для приложений на базе Tauri + SurrealDB, не привязанный к предметной области.**

Предоставляет полноценную инфраструктуру оболочки UI в стиле VS Code и мощную систему макросов для Rust-бэкенда. Вы можете с первого дня сосредоточиться исключительно на бизнес-логике вашего приложения.

---

## 🏗️ Архитектура

Фреймворк строго разделен на два независимых слоя:
1. **Backend (`backend/`)**: Команды Rust Tauri и интеграция с SurrealDB.
2. **Frontend (`frontend/`)**: Composables Vue 3, UI компоненты и CSS в стиле Glassmorphism.

---

## 🚀 Пошаговое руководство: Как использовать

### 1. Интеграция Бэкенда

Бэкенд предоставляет пакет `surreal_domain`, который включает макрос `entity_commands!`. Этот макрос автоматически генерирует полные CRUD-команды Tauri (Создание, Чтение, Обновление, Удаление) для ваших доменных моделей в SurrealDB.

#### Настройка `Cargo.toml`:
Подключите макрос к вашему Tauri-проекту:
```toml
[dependencies]
surreal_domain = { path = "../tauri-surreal-kit/backend/surreal_domain/surreal_domain_facade" }
```

#### Определение доменных моделей:
Создайте структуры (structs) в вашем приложении Tauri и реализуйте для них `Serialize` и `Deserialize`.

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub age: u8,
}
```

#### Реализация трейта `SurrealDb`:
Вы должны реализовать трейт `surreal_domain::SurrealDb` для вашего состояния `AppState`. Это укажет макросу, как получить доступ к вашему экземпляру SurrealDB.

```rust
use surreal_domain::SurrealDb;
use surrealdb::engine::local::Db;

pub struct AppState {
    pub db: surrealdb::Surreal<Db>,
}

impl SurrealDb for AppState {
    fn get_db(&self) -> &surrealdb::Surreal<Db> {
        &self.db
    }
}
```

#### Генерация команд с `entity_commands!`:
В файле `main.rs` используйте макрос для генерации обработчиков вызовов (invoke handlers) Tauri.

```rust
use surreal_domain::entity_commands;

fn main() {
    tauri::Builder::default()
        // Макрос принимает две части:
        // 1. Кастомные/Системные команды (например, save_settings)
        // 2. @entities: [Ваши модели] -> Генерирует для них CRUD
        .invoke_handler(entity_commands![
            // Ваши кастомные команды
            my_custom_command,
            // Системные команды фреймворка
            upload_photo, save_settings, load_settings,
            // Автоматическая генерация CRUD для этих сущностей
            @entities: [Character, Location, Faction],
        ])
        .run(tauri::generate_context!())
        .expect("ошибка при запуске приложения tauri");
}
```

**Что делает макрос:**
Для структуры `Character` он автоматически сгенерирует и зарегистрирует:
- `create_character(project, data)`
- `update_character(project, id, data)`
- `get_character(project, id)`
- `get_character_list(project)`
- `delete_character(project, id)`

### 2. Интеграция Фронтенда (Vue 3)

Фронтенд использует `useShellApp` для управления сплит-панелями, горячими клавишами, масштабированием и сохранением состояния.

#### Настройка `__APP_CONFIG__`:
В вашем `index.html` или `app.html` определите глобальную конфигурацию для изоляции ключей `localStorage` и настройки приложения.

```html
<script>
  window.__APP_CONFIG__ = {
    id: 'my-rpg-editor',       // Используется как префикс: 'my-rpg-editor:settings'
    name: 'My RPG Editor',
    storageKey: 'my-rpg-editor:settings'
  };
</script>
```

#### Обязательный выбор языка при первом запуске
На splash-экране теперь появляется обязательный выбор языка, если ранее не было сохранено `locale`. Выбранный язык сохраняется в `localStorage` по ключу `storageKey` из `__APP_CONFIG__` (по умолчанию `app:settings`).

Если язык уже выбран и вы хотите протестировать повторное появление выбора, удалите ключ настроек и перезагрузите страницу:
```js
localStorage.removeItem('app:settings');
location.reload();
```

#### Использование `useShellApp`:
В вашем главном `app.ts` или компоненте Vue инициализируйте оболочку. Она берет на себя все сложное поведение в стиле VS Code.

```typescript
import { useShellApp } from 'tauri-surreal-kit/frontend/src/js/composables/useShellApp';

const shell = useShellApp({
  storagePrefix: 'my-rpg-editor',
  appId: 'my-rpg-editor',
  
  // Определите, что происходит при нажатии Ctrl+S
  onSave: async () => { 
    console.log("Сохранение активных вкладок...");
    await myDomainSaveLogic(shell.allTabs.value); 
  },
  
  // Сохраняйте собственные переменные (например, состояние боковой панели) в кэше оболочки
  serializeExtra: () => ({ activeView: activeView.value }),
  restoreExtra: async (saved) => { activeView.value = saved.activeView; },
  
  quickOpenRef,
  commandPaletteRef,
});
```

### 3. Подключаемые UI-компоненты

Фреймворк предоставляет UI-компоненты, которые ничего не знают о вашей бизнес-логике. Вы внедряете в них данные через свойства (props).

#### Палитра команд (Command Palette - `Ctrl+Shift+P`):
Передайте ваши доменные команды. Системные команды (Масштаб, Сохранить, Боковая панель) встроены по умолчанию.

```html
<CommandPalette
  ref="commandPaletteRef"
  :commands="[
    { id: 'new-char', title: 'Новый персонаж', icon: '👤', action: () => addChar() },
    { id: 'new-loc', title: 'Новая локация', icon: '🗺️', action: () => addLoc() },
  ]"
  @save="shell.saveAll"
/>
```

#### Быстрое открытие (Quick Open - `Ctrl+P`):
Передайте асинхронную функцию для подгрузки данных по требованию.

```html
<QuickOpen
  ref="quickOpenRef"
  :dataSource="async () => fetchAllMyEntitiesAsQuickOpenItems()"
  @select="openItemInEditor"
/>
```

#### Дерево навигации (Explorer Tree):
Универсальный рекурсивный компонент-дерево для файловых менеджеров или иерархических структур.

```html
<ExplorerTree 
  :sections="[
    { id: 'chars', title: 'Персонажи', nodes: myCharacterTreeData }
  ]"
  @open="handleNodeOpen"
  @rename="handleNodeRename"
/>
```

---

## ⚙️ Встроенные библиотеки и сервисы

### Система CSS (`frontend/src/css/`)
- Чистые дизайн-токены Glassmorphism (`glass-theme.css`, `glass-animations.css`). Tailwind не требуется.
- Динамически масштабируется с помощью горячих клавиш оболочки (`Ctrl+=`, `Ctrl+-`).

### Сервисы (`frontend/src/js/services/`)
- `api.service.ts`: Обёртка над Tauri `invoke`, нормализует идентификаторы SurrealDB (`type::thing()`).
- `settings.service.ts`: Управляет темами, CSS-переменными и сохраняет их через ключ `__APP_CONFIG__.storageKey`.
- `form.service.ts`: Динамически генерирует формы на основе JSON-схем.

### Оболочка Composable (`useShellApp.ts`)
Управляет:
- Макетом вкладок и сплит-панелей (`useEditorGroups`).
- Уведомлениями и логами (`addToast`, `addLog`).
- Изменением размеров панелей и сохранением раскладки.
- Маршрутизацией горячих клавиш.

---

## 🪟 WorkspaceLayout — Многооконный редактор

Drop-in VS Code-подобный редактор с перетаскиваемыми вкладками.

```html
<WorkspaceLayout ref="workspaceRef" :sidebar-visible="true">
  <!-- Левая панель -->
  <template #explorer>
    <ExplorerTree :sections="treeSections" @open="openInEditor" />
  </template>

  <!-- Контент вкладки, ключи по tab.tabType -->
  <template #tab-content="{ tab }">
    <MyEntityEditor v-if="tab.tabType === 'entity'" :tab="tab" />
    <MyChapterEditor v-else-if="tab.tabType === 'chapter'" :tab="tab" />
  </template>
</WorkspaceLayout>
```

- `Ctrl+\` разделяет текущую панель вправо
- Ширина боковой панели и групп изменяется перетаскиванием

---

## 🕰️ HistorySidebar — Git-подобная история сущностей

Показывает таймлайн сохраненных снимков для любой сущности. Позволяет восстановить, закрепить и удалить.

```html
<HistorySidebar
  :project="currentProjectId"
  type-key="character"
  @restore="applySnapshot"
/>
```

**Требование для бэкенда**: ваша команда `save_*` должна вызывать `save_schema_history()`. Таблица истории определяется в вашем `.surql` файле схемы.

---

## 🧩 EntityService — Универсальный API-клиент

Автоматически сопоставляет команды CRUD, сгенерированные `#[surreal_entity]`.

```typescript
import { EntityService } from '../js/services/entity.service';

interface Character { id?: string; name: string; age: number; }
const api = new EntityService<Character>('character');

// Автоматически вызывает: get_characters, save_character, delete_character, search_characters
const all  = await api.getAll('projects:123');
const one  = await api.getOne('characters:abc');
await api.save({ name: 'Alice', age: 30 });
await api.delete('characters:abc');
const hits = await api.search('projects:123', 'Alice');
```

---

## 🛠️ Скрипт настройки проекта

Когда вы форкаете/клонируете этот набор, запустите скрипт настройки, чтобы переименовать все плейсхолдеры:

```bash
node setup.js
```

Он спросит имя проекта и bundle ID, затем автоматически обновит `Cargo.toml`, `tauri.conf.json` и `package.json`.

---

## 🔧 Автогенерация TypeScript биндингов

Когда вы компилируете Rust-бэкенд (`cargo build`), макрос `#[surreal_entity]` автоматически генерирует файлы интерфейсов TypeScript в:

```
frontend/src/js/types/bindings/<entity_name>.ts
```

Пример — если вы определили:
```rust
#[surreal_entity(table = "articles")]
pub struct Article { pub title: String, pub published: bool }
```

Макрос создаёт `bindings/article.ts`:
```typescript
// AUTO-GENERATED BY SURREAL_DOMAIN MACROS
export interface Article {
  id?: string;
  project_id?: string;
  title: string;
  published: boolean;
}
```

Больше не нужно вручную поддерживать интерфейсы.
