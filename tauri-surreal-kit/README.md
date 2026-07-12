# tauri-surreal-kit

**Domain-agnostic Tauri + SurrealDB application framework.**

Provides the full VS Code-inspired UI shell infrastructure and a powerful Rust backend macro system, so you can focus entirely on your domain logic from day one.

---

## 🏗️ Architecture

The framework is strictly divided into two decoupled layers:
1. **Backend (`backend/`)**: Rust Tauri commands and SurrealDB integration.
2. **Frontend (`frontend/`)**: Vue 3 composables, UI components, and Glassmorphism CSS.

---

## 🚀 Step-by-Step Guide: How to Use

### 1. Integrate the Backend

The backend provides the `surreal_domain` crate, which includes the `entity_commands!` macro. This macro automatically generates full CRUD (Create, Read, Update, Delete) Tauri commands for your domain models in SurrealDB.

#### Setup `Cargo.toml`:
Add the macro to your Tauri project:
```toml
[dependencies]
surreal_domain = { path = "../tauri-surreal-kit/backend/surreal_domain/surreal_domain_facade" }
```

#### Define Your Domain Models:
In your Tauri app, create your structs and implement `Serialize` and `Deserialize`.

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub age: u8,
}
```

#### Implement `SurrealDb` Trait:
You must implement the `surreal_domain::SurrealDb` trait for your `AppState`. This tells the macro how to access your SurrealDB instance.

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

#### Generate Commands with `entity_commands!`:
In `main.rs`, use the macro to generate the Tauri invoke handlers. 

```rust
use surreal_domain::entity_commands;

fn main() {
    tauri::Builder::default()
        // The macro takes two parts:
        // 1. Custom/System commands (like save_settings)
        // 2. @entities: [Your Models] -> Generates CRUD for these
        .invoke_handler(entity_commands![
            // Your custom commands
            my_custom_command,
            // Framework system commands
            upload_photo, save_settings, load_settings,
            // Auto-generate CRUD for these entities
            @entities: [Character, Location, Faction],
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**What the macro does:**
For `Character`, it automatically generates and registers:
- `create_character(project, data)`
- `update_character(project, id, data)`
- `get_character(project, id)`
- `get_character_list(project)`
- `delete_character(project, id)`

### 2. Integrate the Frontend (Vue 3)

The frontend uses `useShellApp` to handle split-pane editors, hotkeys, zooming, and saving state.

#### Define `__APP_CONFIG__`:
In your `index.html` or `app.html`, define the global configuration to namespace `localStorage` and set app info.

```html
<script>
  window.__APP_CONFIG__ = {
    id: 'my-rpg-editor',       // Used as prefix: 'my-rpg-editor:settings'
    name: 'My RPG Editor',
    storageKey: 'my-rpg-editor:settings'
  };
</script>
```

#### Mandatory locale selection on first launch
The shell splash now includes a mandatory language picker if no saved locale exists yet. The selected language is stored in `localStorage` under the configured `storageKey` (default `app:settings`), so the app remembers the user's choice.

If you already have a language saved and want to test the selector again, remove the settings key and reload:
```js
localStorage.removeItem('app:settings');
location.reload();
```

#### Use `useShellApp`:
In your main `app.ts` or Vue component, initialize the shell. It manages all the complex VS Code-like behavior.

```typescript
import { useShellApp } from 'tauri-surreal-kit/frontend/src/js/composables/useShellApp';

const shell = useShellApp({
  storagePrefix: 'my-rpg-editor',
  appId: 'my-rpg-editor',
  
  // Define what happens when the user presses Ctrl+S
  onSave: async () => { 
    console.log("Saving active tabs...");
    await myDomainSaveLogic(shell.allTabs.value); 
  },
  
  // Persist your own variables (like sidebar state) in the shell's layout cache
  serializeExtra: () => ({ activeView: activeView.value }),
  restoreExtra: async (saved) => { activeView.value = saved.activeView; },
  
  quickOpenRef,
  commandPaletteRef,
});
```

### 3. Use Pluggable UI Components

The kit provides UI components that are unaware of your domain logic. You inject data into them via props.

#### Command Palette (`Ctrl+Shift+P`):
Pass your domain commands. System commands (Zoom, Save, Toggle Sidebar) are injected automatically.

```html
<CommandPalette
  ref="commandPaletteRef"
  :commands="[
    { id: 'new-char', title: 'New Character', icon: '👤', action: () => addChar() },
    { id: 'new-loc', title: 'New Location', icon: '🗺️', action: () => addLoc() },
  ]"
  @save="shell.saveAll"
/>
```

#### Quick Open (`Ctrl+P`):
Supply an async function to load data on demand.

```html
<QuickOpen
  ref="quickOpenRef"
  :dataSource="async () => fetchAllMyEntitiesAsQuickOpenItems()"
  @select="openItemInEditor"
/>
```

#### Explorer Tree:
A generic recursive tree component for file explorers or hierarchical structures.

```html
<ExplorerTree 
  :sections="[
    { id: 'chars', title: 'Characters', nodes: myCharacterTreeData }
  ]"
  @open="handleNodeOpen"
  @rename="handleNodeRename"
/>
```

---

## ⚙️ Core Libraries & Services Included

### CSS System (`frontend/src/css/`)
- Pure Glassmorphism tokens (`glass-theme.css`, `glass-animations.css`). No Tailwind required.
- Dynamically scales via the shell zoom shortcuts (`Ctrl+=`, `Ctrl+-`).

### Services (`frontend/src/js/services/`)
- `api.service.ts`: Wraps Tauri `invoke`, normalizes SurrealDB IDs (`type::thing()`).
- `settings.service.ts`: Manages themes, CSS variables, and stores them via `__APP_CONFIG__.storageKey`.
- `form.service.ts`: Generates forms dynamically based on a JSON-schema.

### Shell Composable (`useShellApp.ts`)
Handles:
- Split-pane editor layout (`useEditorGroups`).
- Toasts and console logs (`addToast`, `addLog`).
- Layout resizing and persistence.
- Hotkey routing.

---

## 🪟 WorkspaceLayout — Multi-Pane Editor

Drop-in VS Code-style split editor with draggable tabs.

```html
<WorkspaceLayout ref="workspaceRef" :sidebar-visible="true">
  <!-- Left panel -->
  <template #explorer>
    <ExplorerTree :sections="treeSections" @open="openInEditor" />
  </template>

  <!-- Tab content, keyed by tab.tabType -->
  <template #tab-content="{ tab }">
    <MyEntityEditor v-if="tab.tabType === 'entity'" :tab="tab" />
    <MyChapterEditor v-else-if="tab.tabType === 'chapter'" :tab="tab" />
  </template>
</WorkspaceLayout>
```

- `Ctrl+\` splits the current pane right
- Sidebar and group widths are resizable by drag

---

## 🕰️ HistorySidebar — Git-Like Entity History

Shows a timeline of saved snapshots for any entity. Allows restore, pin, and delete.

```html
<HistorySidebar
  :project="currentProjectId"
  type-key="character"
  @restore="applySnapshot"
/>
```

**Backend requirement**: your entity's `save_*` command must call `save_schema_history()`. The history table is defined in your `.surql` schema file.

---

## 🧩 EntityService — Universal API Client

Automatically maps to the CRUD commands generated by `#[surreal_entity]`.

```typescript
import { EntityService } from '../js/services/entity.service';

interface Character { id?: string; name: string; age: number; }
const api = new EntityService<Character>('character');

// Auto-calls: get_characters, save_character, delete_character, search_characters
const all  = await api.getAll('projects:123');
const one  = await api.getOne('characters:abc');
await api.save({ name: 'Alice', age: 30 });
await api.delete('characters:abc');
const hits = await api.search('projects:123', 'Alice');
```

---

## 🛠️ Project Setup Script

When you fork/clone this kit, run the setup script to rename all placeholders:

```bash
node setup.js
```

It will ask for your project name and bundle ID, then automatically update `Cargo.toml`, `tauri.conf.json`, and `package.json`.

---

## 🔧 TypeScript Bindings Auto-Generation

When you compile the Rust backend (`cargo build`), the `#[surreal_entity]` macro automatically generates TypeScript interface files into:

```
frontend/src/js/types/bindings/<entity_name>.ts
```

Example — if you define:
```rust
#[surreal_entity(table = "articles")]
pub struct Article { pub title: String, pub published: bool }
```

The macro produces `bindings/article.ts`:
```typescript
// AUTO-GENERATED BY SURREAL_DOMAIN MACROS
export interface Article {
  id?: string;
  project_id?: string;
  title: string;
  published: boolean;
}
```

No manual interface maintenance ever again.
