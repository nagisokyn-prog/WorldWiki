---
trigger: always_on
---

# ⚡ ПРАВИЛО 08: СТАНДАРТ ПРОИЗВОДИТЕЛЬНОСТИ И РЕАКТИВНОЙ ЦЕЛОСТНОСТИ ФРОНТЕНДА (UNIVERSAL FRONTEND OPTIMIZATION & REACTIVE INTEGRITY)

> **СТАТУС**: КРИТИЧЕСКИЙ (Zero Performance Degradation, Zero Memory Leaks, Zero CPU Spikes).

Ниже зафиксированы **железные стандарты фронтенд-инженерии**, обязательные к исполнению во всех компонентах.

## РАЗДЕЛ I. РЕАКТИВНОСТЬ И УПРАВЛЕНИЕ СОСТОЯНИЕМ

### 1.1. Запрет глубокой реактивности (`reactive` / `ref`) на тяжелых структурах данных

- **ОШИБКА**:
  ```typescript
  // ХУДШАЯ ПРАКТИКА: Vue рекурсивно оборачивает 10 000 узлов AST или записей в Proxy
  const documentAST = ref<LargeSemanticDocument>(astData);
  const bigHistoryLog = reactive<HistoryRecord[]>(rawLogs);
  ```
- **Почему это убивает систему**: Инициализация 5 000 элементов с `ref` занимает ~1200 мс против 260 мс с `shallowRef`. Каждое чтение свойства запускает отслеживание трекеров `track()`, перегружая CPU.
- **ПРАВИЛО: Использовать `shallowRef` + `triggerRef`, `markRaw` и `Object.freeze`**:

```typescript
// 1. Для мутируемых тяжелых данных — shallowRef:
const documentAST = shallowRef<LargeSemanticDocument>(astData);

// Если изменили вложенное свойство без замены ссылки — точечно уведомляем Vue:
documentAST.value.chapters[0].title = "Новая глава";
triggerRef(documentAST); // Эквивалент «Vue, перерисуй зависимых» без глубокого Proxy!

// 2. Для статичных справочников и неизменных данных из БД:
const staticDictionary = Object.freeze(loadedDictionary); // Полный запрет реактивности

// 3. Для сторонних классов и редакторов (Monaco, Tiptap, Canvas, Three.js):
const editorInstance = markRaw(new Editor());
```

### 1.2. Контроль глубины `watch` (Vue 3.5+ `{ deep: N }`) и запрет каскадов

- **ОШИБКА**:
  ```typescript
  watch(
    () => props.modelValue,
    (newVal) => {
      validateAndEmit(newVal); // Вызывает emit('update:modelValue') -> бесконечный реактивный шторм!
    },
    { deep: true },
  );
  ```
- 🧠 **Почему это убивает систему**: `deep: true` рекурсивно читает весь объект. Если внутри обработчика происходит `emit` или мутация состояния, возникает циклический реактивный дребезг (cascading re-renders).
- **ПРАВИЛО: Числовая глубина `{ deep: 1 }` или точечные геттеры**:
  ```typescript
  // Вариант А: Точечные геттеры скаляров (Рекомендуется)
  watch(
    () => [props.modelValue.id, props.modelValue.year, props.modelValue.status],
    ([newId, newYear, newStatus]) => {
      /* обработка */
    },
  );

  // Вариант Б: Слежение строго за первым уровнем вложенности (Vue 3.5+)
  watch(
    () => props.modelValue,
    (newVal) => {
      /* реагирует на добавление/удаление элементов массива, но не на каждое вложенное поле */
    },
    { deep: 1 },
  );
  ```

### 1.3. Утечка асинхронных и оторванных `watch` (Out-of-Scope Watchers)

- **ОШИБКА**: Создание `watch` или `watchEffect` внутри `setTimeout`, промисов или асинхронных функций:

```typescript
async function initFeature() {
  const data = await fetchConfig();
  //  Этот watcher НЕ привязан к жизненному циклу компонента и никогда не уничтожится!
  watch(() => data.status, handleStatusChange);
}
```

- **ПРАВИЛО: Сохранять handle остановки или использовать `effectScope`**:
  ```typescript
  let unwatch: (() => void) | null = null;

  async function initFeature() {
    const data = await fetchConfig();
    unwatch = watch(() => data.status, handleStatusChange);
  }

  onUnmounted(() => {
    if (unwatch) unwatch();
  });
  ```

---

### 🔴 1.4. Запрет некэшируемых вызовов функций в шаблоне (`Template Methods`)

- ❌ **ОШИБКА**:
  ```html
  <!-- ХУДШАЯ ПРАКТИКА: Метод computeStatus() вызывается при КАЖДОМ движении мыши и кадре рендера -->
  <div v-for="item in items" :key="item.id">
    <span>{{ computeStatus(item, currentFilter) }}</span>
  </div>
  ```
- 🧠 **Почему это убивает систему**: Обычные функции в шаблоне не имеют кэша зависимостей. При любом обновлении родительского компонента они принудительно пересчитываются $N$ раз.
- ✅ **ПРАВИЛО: Выносить в типизированный `computed` или мапу**:
  ```typescript
  const itemStatuses = computed(() => {
    const map = new Map<string, string>();
    for (const item of items.value) {
      map.set(item.id, computeStatus(item, currentFilter.value));
    }
    return map;
  });
  ```

---

## 🛑 РАЗДЕЛ II. DOM, РЕНДЕРИНГ И LAYOUT

### 🔴 2.1. Строгое разграничение `v-if` (Lazy Mount) vs `v-show` (CSS Toggle)

- ❌ **ОШИБКА**:
  ```html
  <!-- ХУДШАЯ ПРАКТИКА: 50 свернутых аккордеонов монтируются сразу в DOM с кучей watchers -->
  <div v-for="panel in panels" :key="panel.id">
    <div v-show="panel.isOpen" class="content">
      <HeavyUniversalDatePicker :data="panel" />
    </div>
  </div>
  ```
- 🧠 **Почему это убивает систему**: `v-show` ставит `display: none`. Все дочерние компоненты монтируются, создают VNode, вешают таймеры и watchers.
- ✅ **ПРАВИЛО**:
  - **`v-if`** — для всех табов, модалок, выпадающих списков, панелей аккордеонов и тяжелых форм (ленивый монтаж и полная выгрузка из памяти);
  - **`v-show`** — **только** для сверхлегких микро-элементов (иконка загрузки, тултип), переключаемых десятки раз в секунду.

---

### 🔴 2.2. Мемоизация виртуального DOM через `v-memo`

- 💡 **ИНСТРУМЕНТ**: `v-memo` позволяет полностью пропускать фазу VNode diffing для элементов списка, если их ключевые зависимости не изменились:
  ```html
  <!-- Ререндерится ТОЛЬКО тот элемент списка, у которого изменился статус или выбор -->
  <div
    v-for="item in heavyList"
    :key="item.id"
    v-memo="[item.id === selectedId, item.updatedAt, item.status]"
    class="heavy-row"
  >
    <ComplexItemView :item="item" :is-selected="item.id === selectedId" />
  </div>
  ```

---

### 🔴 2.3. Защита от затопления DOM (DOM Flooding) и Виртуализация

- ❌ **ОШИБКА**: Генерация тысяч DOM-узлов в селекторах, таблицах или барабанах.
- ✅ **ПРАВИЛО: Пороговое переключение и Виртуализация**:
  - $\le 30-50$ элементов: стандартный список/карусель;
  - $> 50$ элементов: автоматическое переключение на `<input type="number">` или использование виртуального скролла (`TanStack Virtual` / `vue-virtual-scroller`). В DOM всегда находится строго ~20 видимых строк.

---

### 🔴 2.4. Запрет Layout Thrashing (Forced Synchronous Layouts)

- ❌ **ОШИБКА**: Чередование чтения геометрии и записи стилей в цикле:
  ```typescript
  // ХУДШАЯ ПРАКТИКА: Заставляет браузер делать reflow на каждой итерации!
  elements.forEach((el) => {
    const h = el.offsetHeight; // ЧТЕНИЕ (Layout)
    el.style.height = `${h + 10}px`; // ЗАПИСЬ (Invalidation)
  });
  ```
- ✅ **ПРАВИЛО: Разделять фазы чтения и записи (Batch DOM Operations)**:
  ```typescript
  // Фаза 1: Собрать все замеры
  const heights = elements.map((el) => el.offsetHeight);
  // Фаза 2: Записать стили через requestAnimationFrame
  requestAnimationFrame(() => {
    elements.forEach((el, i) => {
      el.style.height = `${heights[i] + 10}px`;
    });
  });
  ```

---

### 🔴 2.5. Запрет `:key="index"` для динамических коллекций

- ❌ **ОШИБКА**: `<div v-for="(item, index) in items" :key="index">`
- ✅ **ПРАВИЛО**: Использовать стабильный уникальный ID: `:key="item.id"` или `:key="item.uuid"`.

---

### 🔴 2.6. Контроль библиотек анимаций (`v-auto-animate` / `MutationObserver`)

- ❌ **ОШИБКА**: Навешивание `v-auto-animate` на внутренние формы настроек, таблицы или статичные списки инпутов.
- ✅ **ПРАВИЛО**: Использовать `v-auto-animate` **исключительно** на верхнеуровневых динамических контейнерах добавления/удаления/drag-and-drop карточек.

---

## 🛑 РАЗДЕЛ III. ПАМЯТЬ, СБОРКА МУСОРА (GC), TAURI IPC И ОЧИСТКА

### 🔴 3.1. Утечки памяти в Tauri IPC: Channels и Listeners

- ❌ **ОШИБКА 1**: Забытый unlisten на событиях Tauri:
  ```typescript
  // ХУДШАЯ ПРАКТИКА: При каждом открытии экрана создается новый слушатель, память растет до 1+ GB
  import { listen } from '@tauri-apps/api/event';
  listen('db-sync-progress', (event) => { ... });
  ```
- ❌ **ОШИБКА 2**: Утечка Tauri IPC Channel:
  ```typescript
  const channel = new Channel<ProgressPayload>();
  channel.onmessage = (payload) => { ... };
  // При размонтировании onmessage не очищен -> GC не может собрать компонент!
  ```
- ✅ **ПРАВИЛО: Обязательная очистка каналов и отписка в `onUnmounted`**:
  ```typescript
  let unlistenFn: (() => void) | null = null;
  const channel = new Channel<ProgressPayload>();

  onMounted(async () => {
    channel.onmessage = (payload) => { /* обработка */ };
    unlistenFn = await listen('db-sync-progress', (event) => { ... });
  });

  onUnmounted(() => {
    if (unlistenFn) unlistenFn();
    channel.onmessage = () => {}; // Сброс ссылки на обработчик для GC
  });
  ```

---

### 🔴 3.2. Висячие глобальные слушатели DOM и зомби-таймеры

- ✅ **ПРАВИЛО: Симметричная очистка всех ресурсов**:
  ```typescript
  let timerId: number | null = null;
  const handleResize = () => { ... };

  onMounted(() => {
    window.addEventListener('resize', handleResize);
    timerId = window.setInterval(syncState, 1000);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    if (timerId !== null) clearInterval(timerId);
  });
  ```

---

### 🔴 3.3. Отмена устаревших асинхронных задач (`AbortController`)

- ✅ **ПРАВИЛО: Предотвращать гонки данных (Race Conditions) и фоновую работу**:
  ```typescript
  let abortController: AbortController | null = null;

  async function loadData() {
    abortController?.abort();
    abortController = new AbortController();
    try {
      const data = await apiCall({ signal: abortController.signal });
      state.value = data;
    } catch (e: any) {
      if (e.name === "AbortError") return; // Штатная отмена
      console.error(e);
    }
  }

  onUnmounted(() => {
    abortController?.abort();
  });
  ```

## 🛑 РАЗДЕЛ IV. АЛГОРИТМИЧЕСКАЯ СЛОЖНОСТЬ И КЭШИРОВАНИЕ

### 🔴 4.1. Запрет алгоритмов $O(N)$ в путях рендеринга

- ❌ **ОШИБКА**: Суммирование дней годами через цикл `for (let y = 1; y < year; y++)`.
- ✅ **ПРАВИЛО: Аналитическое $O(1)$ для всех периодических и календарных расчетов**:
  $$\text{LeapYears}(Y) = \lfloor Y/4 \rfloor - \lfloor Y/100 \rfloor + \lfloor Y/400 \rfloor$$
  $$\text{TotalDays}(Y) = (Y - 1) \times D_{\text{norm}} + \text{LeapYears}(Y - 1) \times D_{\text{offset}}$$

### 🔴 4.2. Мемоизация чистых доменных функций

- ✅ **ПРАВИЛО: Кэшировать повторяющиеся вычисления через `Map` / LRU**:
  ```typescript
  const daysInMonthCache = new Map<string, number>();

  export function getDaysInMonth(
    calId: string,
    year: number,
    month: number,
  ): number {
    const key = `${calId}:${year}:${month}`;
    const cached = daysInMonthCache.get(key);
    if (cached !== undefined) return cached;

    const result = computeDays(calId, year, month);
    daysInMonthCache.set(key, result);
    return result;
  }
  ```

---

## 🛑 РАЗДЕЛ V. МАТРИЦА СРАВНЕНИЯ ФРЕЙМВОРКОВ (FRAMEWORK TRAPS)

| Фреймворк          | Типичная ловушка Вайбкодера                                                                                                                       | Инженерный стандарт оптимизации                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Vue 3**          | Оборачивание всего в `ref()` / `reactive()`, использование `v-show` для модалок, глубокие `watch(..., { deep: true })`, забытые unlisten в Tauri. | `shallowRef` + `triggerRef`, `markRaw`, `Object.freeze`, `v-if`, `v-memo`, точечные геттеры в `watch`, симметричные `onUnmounted`. |
| **React**          | Создание стрелочных функций и объектов в JSX (`onClick={() => ...}`, `style={{...}}`), Context API blast radius (перерисовка всех потребителей).  | `useCallback`, `useMemo`, разделение контекстов на State/Dispatch, селекторы (Zustand/Jotai), React Profiler.                      |
| **Blazor**         | Вызовы `StateHasChanged()` в цикле, множественный JSInterop в UI-потоке, отсутствие виртуализации списков.                                        | Переопределение `ShouldRender()`, батчинг JS-вызовов, использование компонента `<Virtualize>`.                                     |
| **Solid / Svelte** | Разрушение реактивности через деструктуризацию пропсов `const { a, b } = props;`.                                                                 | Использование `toRefs()`, `props.a` или утилит `splitProps` для сохранения реактивных сигналов.                                    |

---
