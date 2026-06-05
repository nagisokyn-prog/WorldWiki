# План исправления багов с созданием и отображением сущностей

## 📋 Описание проблемы

### Проблема 1: ID вместо имени сущности в сайдбаре
- **Симптом**: При создании сущности в сайдбаре выбора отображается ID из БД вместо имени
- **Корневая причина**: 
  - Функция `addNewEntity` создает сущность с временным именем типа `"Персонаж 1234567890"`
  - API `saveEntity` возвращает только `{ success: boolean }`, не возвращая созданную сущность
  - После перезагрузки списка может произойти рассинхронизация имена/ID

### Проблема 2: Отсутствие проверки и ввода имени сущности
- **Симптом**: После создания сущности нет диалога для ввода корректного имени
- **Корневая причина**: 
  - Сущность сразу открывается в редакторе с временным именем
  - Пользователь может забыть изменить имя или не знает, что нужно это сделать

### Проблема 3: Баг при открытии двух сущностей с одинаковыми ID
- **Симптом**: При попытке открыть две сущности с одинаковым ID, открывается только первая
- **Корневая причина**: 
  - Функция `openEntity` использует `entity.id` как уникальный ключ для tab: `const id = String(entity.id)`
  - Если две сущности имеют одинаковый ID, то вторая перезатирает первую в `openEditors`
  - Проверка `if (!existing)` предотвращает добавление дубликата
  - Это указывает на проблему в Rust-коде, где ID не гарантирует уникальность

## 🔍 Анализ логики

### Поток создания сущности (текущий):
```
1. Пользователь нажимает "+ Добавить"
   ↓
2. addNewEntity() генерирует временное имя: "{тип} {timestamp}"
   ↓
3. apiService.saveEntity() - отправляет { name: newName }
   ↓
4. Rust/Tauri генерирует ID и сохраняет в БД
   ↓
5. API возвращает только { success: true }
   ↓
6. loadEntityList() перезагружает список из БД
   ↓
7. Берется последняя сущность из filteredEntityList (может быть неправильно!)
   ↓
8. openEntity() открывает сущность в редакторе
   ↓
9. В сайдбаре показывается {{ entity.name || entity.title || entity.id }}
```

### Проблемные места:
- **Шаг 5**: API не возвращает ID новой сущности → не знаем, какую найти в новом списке
- **Шаг 7**: Предположение, что последняя сущность - новая может быть ошибочным:
  - Если список отсортирован по имени, новая может быть не в конце
  - Если другой пользователь создал сущность одновременно, порядок может измениться
- **Шаг 9**: Если `name` не установлено, показывается `id`

### Проблема с дублирующимися ID:
```javascript
// app.ts, функция openEntity
const id = String(entity.id);
const existing = openEditors.value.find(e => e.id === id);
if (!existing) {
  openEditors.value.push({
    id,  // ← Использование ID как уникального ключа
    title: String(detail.name || entity.name || id),
    ...
  });
}
activeEditorId.value = id; // ← Один ID может указывать на разные сущности
```

Если ID не уникален:
- Первая сущность с ID=123 откроется
- Вторая сущность с ID=123 не откроется (т.к. `existing` не будет null)
- `activeEditorId` будет указывать на первую сущность

## 🛠️ План исправления

### Этап 1: Гарантировать уникальность ID (Rust/Tauri side)
**Файл**: `src-tauri/src/main.rs` или `logic/mod.rs`

**Что нужно сделать**:
1. ✅ Проверить, что при создании новой сущности генерируется уникальный ID
2. ✅ Убедиться, что UUID или другой механизм используется правильно
3. ✅ Добавить проверку уникальности при сохранении

**Риск**: Если ID генерируется некорректно, это требует изменений в Rust-коде

---

### Этап 2: Улучшить возвращаемое значение API
**Файл**: `src-tauri/src/main.rs` (Rust side)

**Что нужно сделать**:
1. Изменить тип возврата `save_entity` с `{ success: boolean }` на `{ success: boolean, id?: string }`
2. Возвращать ID созданной сущности (если это была новая сущность)
3. Обновить TypeScript interface в `api.service.ts`

**Пример возврата**:
```json
{
  "success": true,
  "id": "new-uuid-here"  // Если была новая сущность
}
```

---

### Этап 3: Исправить логику в `addNewEntity`
**Файл**: `src/js/app/app.ts`

**Текущий код** (lines 555-571):
```typescript
const addNewEntity = async () => {
  if (!currentSidebarTab.value) return;
  try {
    const timestamp = new Date().getTime();
    const newName = `${activeSidebarItem.value?.title || 'Элемент'} ${timestamp}`;
    await apiService.saveEntity(projectName, currentSidebarTab.value, { name: newName } as any);
    addLog(`Entity -> Created ${newName}`, 'success');
    await loadEntityList(currentSidebarTab.value);
    
    // Находим новую сущность и открываем
    const newEntity = filteredEntityList.value[filteredEntityList.value.length - 1];
    if (newEntity) {
      await openEntity(newEntity);
    }
  } catch (e) {
    addLog(`Entity -> Error: ${e}`, 'error');
  }
};
```

**Исправление**:
```typescript
const addNewEntity = async () => {
  if (!currentSidebarTab.value) return;
  try {
    // Создаем сущность с пустым именем (или placeholder)
    const tempData = { name: '' };
    const saveResult = await apiService.saveEntity(projectName, currentSidebarTab.value, tempData as any);
    
    // Получаем ID из результата
    const newEntityId = (saveResult as any).id;
    
    if (!newEntityId) {
      addLog(`Entity -> Error: No ID returned`, 'error');
      return;
    }
    
    // Загружаем полные данные новой сущности
    const newEntity = await apiService.getEntity(projectName, currentSidebarTab.value, newEntityId);
    
    // Показываем диалог для ввода имени (см. Этап 4)
    await showEntityNameDialog(newEntity);
    
    // Перезагружаем список и открываем сущность
    await loadEntityList(currentSidebarTab.value);
    await openEntity(newEntity);
    
    addLog(`Entity -> Created with ID ${newEntityId}`, 'success');
  } catch (e) {
    addLog(`Entity -> Error: ${e}`, 'error');
  }
};
```

**Улучшения**:
- ✅ Используем ID из результата `saveEntity`, а не ищем по позиции в списке
- ✅ Загружаем полную сущность после создания
- ✅ Показываем диалог для ввода имени
- ✅ Гарантируем, что открываем именно созданную сущность

---

### Этап 4: Добавить диалог для ввода имени
**Файл**: `src/js/app/app.ts`

**Что нужно сделать**:
1. Создать функцию `showEntityNameDialog(entity)` 
2. Показать модальное окно с полем ввода
3. При подтверждении обновить имя сущности
4. При отмене показать fallback имя (временное)

**Новая функция**:
```typescript
const showEntityNameDialog = async (entity: Record<string, unknown>): Promise<void> => {
  return new Promise((resolve) => {
    const dialogHtml = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>Введите имя новой сущности</h2>
          <input 
            type="text" 
            id="entity-name-input" 
            placeholder="Имя сущности..." 
            class="input-base"
            style="width: 100%; margin: 16px 0; padding: 8px 12px;"
            autofocus
          />
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="btn-cancel" class="btn-outline-new">Отмена</button>
            <button id="btn-save" class="btn-new">Сохранить</button>
          </div>
        </div>
      </div>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = dialogHtml;
    document.body.appendChild(tempDiv);
    
    const input = document.getElementById('entity-name-input') as HTMLInputElement;
    const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
    const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;
    
    const closeDialog = () => {
      tempDiv.remove();
    };
    
    btnSave.onclick = async () => {
      const newName = input.value.trim();
      if (newName) {
        entity.name = newName;
        await apiService.saveEntity(projectName, currentSidebarTab.value!, entity, String(entity.id));
        addLog(`Entity -> Renamed to "${newName}"`, 'success');
      }
      closeDialog();
      resolve();
    };
    
    btnCancel.onclick = () => {
      closeDialog();
      resolve();
    };
    
    input.focus();
  });
};
```

**Альтернатива**: Использовать существующий `SettingsModal` или создать Vue компонент для диалога

---

### Этап 5: Исправить возможность открытия двух сущностей
**Файл**: `src/js/app/app.ts`

**Текущая проблема** (lines 133-160):
```typescript
const openEntity = async (entity: Record<string, unknown>) => {
  const id = String(entity.id);
  const existing = openEditors.value.find(e => e.id === id);
  if (!existing) {
    // ... создание нового редактора
  }
  activeEditorId.value = id;
};
```

**Проблема**: Если две сущности имеют одинаковый ID (баг в Rust), вторая не откроется.

**Исправления**:
1. **Первый приоритет**: Гарантировать уникальность ID в Rust (Этап 1)
2. **Второй приоритет**: Добавить проверку на дублирование:

```typescript
const openEntity = async (entity: Record<string, unknown>) => {
  const id = String(entity.id);
  const existingTabIndex = openEditors.value.findIndex(e => e.id === id);
  
  if (existingTabIndex === -1) {
    // Нет открытого редактора с этим ID - создаем новый
    try {
      const detail = await apiService.getEntity(projectName, currentSidebarTab.value!, id);
      openEditors.value.push({
        id,
        title: String(detail.name || entity.name || id),
        entityType: currentSidebarTab.value!,
        data: detail as Record<string, unknown>,
        unsaved: false
      });
      addLog(`Editor -> Opened ${currentSidebarTab.value} [${id}]`, 'info');
    } catch (e) {
      addLog(`Editor -> Error opening: ${e}`, 'error');
      return;
    }
  } else {
    // Редактор уже открыт - просто активируем его
    addLog(`Editor -> Already open [${id}]`, 'info');
  }
  
  activeEditorId.value = id;
  showSettings.value = false;
  nextTick(() => {
    nextTick(() => mountEntityEditor(id));
  });
};
```

---

### Этап 6: Добавить валидацию имени в компоненты отображения
**Файл**: `src/app.html` (template)

**Текущий код** (line ~):
```html
<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ entity.name || entity.title || entity.id }}</span>
```

**Улучшение** (добавить функцию-хелпер):
```typescript
const getEntityDisplayName = (entity: Record<string, unknown>): string => {
  const name = String(entity.name || entity.title || '').trim();
  if (name && name.length > 0 && !name.match(/^\d+$/)) {
    return name;
  }
  // Fallback на ID если имя пусто или выглядит как временное
  return `[${String(entity.id || 'Unknown').substring(0, 8)}]`;
};
```

И в шаблоне:
```html
<span>{{ getEntityDisplayName(entity) }}</span>
```

---

## ✅ Чек-лист исправлений

### Frontend (TypeScript/Vue):
- [ ] Исправить `addNewEntity` для использования ID из API результата
- [ ] Добавить функцию `showEntityNameDialog`
- [ ] Добавить валидацию и хелпер `getEntityDisplayName`
- [ ] Добавить обработку ошибок при создании без ID
- [ ] Протестировать создание и открытие нескольких сущностей
- [ ] Протестировать ввод имени в диалоге

### Backend (Rust/Tauri):
- [ ] Проверить генерацию уникальных ID для новых сущностей
- [ ] Изменить сигнатуру `save_entity` для возврата ID
- [ ] Добавить проверку уникальности ID перед сохранением
- [ ] Протестировать массовое создание сущностей
- [ ] Убедиться, что никогда не генерируются дублирующиеся ID

### API контракты:
- [ ] Обновить TypeScript интерфейс `SaveEntityResponse`
- [ ] Документировать возврат ID в комментариях
- [ ] Обновить примеры использования

---

## 🧪 Сценарии тестирования

### Тест 1: Создание сущности
```
1. Нажать "+ Добавить"
2. Убедиться, что появляется диалог ввода имени
3. Ввести имя "Тестовая сущность"
4. Нажать "Сохранить"
5. Проверить, что:
   - В сайдбаре появилось имя (не ID)
   - Сущность открыта в редакторе
   - Имя совпадает в обоих местах
```

### Тест 2: Создание нескольких сущностей
```
1. Создать 3 сущности: "Сущность A", "Сущность B", "Сущность C"
2. Убедиться, что все имена видны в сайдбаре
3. Убедиться, что в логе показаны все ID
4. Открыть каждую последовательно
5. Проверить, что все открываются правильно
```

### Тест 3: Открытие двух сущностей одновременно
```
1. Создать две сущности
2. Нажать на первую → открыть в редакторе
3. Нажать на вторую → открыть в редакторе
4. Убедиться, что обе открыты в разных табах
5. Переключаться между табами
6. Проверить, что данные не смешиваются
```

### Тест 4: Обновление имени существующей сущности
```
1. Создать сущность "Старое имя"
2. Отредактировать в редакторе на "Новое имя"
3. Сохранить (Ctrl+S)
4. Закрыть и переоткрыть
5. Убедиться, что имя сохранилось
```

---

## 📊 Приоритеты

| Приоритет | Этап | Сложность | Время | 
|-----------|------|-----------|-------|
| 🔴 Критич | 1-2 | Высокая | 2-3ч |
| 🔴 Критич | 3-4 | Средняя | 1-2ч |
| 🟡 Высокий | 5-6 | Низкая | 1-2ч |

---

## 📝 Примечания

- **Временное имя**: Использование timestamp хорошо для уникальности, но плохо для UX
- **Диалог ввода**: Должен быть приятным и не раздражающим (может быть модальным или inline)
- **Валидация**: Имя не должно быть пустым или содержать только цифры
- **Rollback**: Если пользователь закроет диалог без ввода имени, оставить пустое имя с fallback на ID
- **Локализация**: Все строки должны быть на русском языке

---

## 🔗 Связанные файлы

- [app.ts](../src/js/app/app.ts) - Основная логика приложения
- [app.html](../src/app.html) - Шаблон с отображением сущностей
- [api.service.ts](../src/js/services/api.service.ts) - API клиент
- [entity.service.ts](../src/js/services/entity.service.ts) - Сервис сущностей
- [main.rs](../src-tauri/src/main.rs) - Rust бэкенд
