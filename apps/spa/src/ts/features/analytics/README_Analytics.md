# 📊 apps/spa/src/ts/features/analytics — Литературная Аналитика и Трекинг Нарратива

> **Назначение**: Подсистема аналитики рукописи и целостности сюжета WorldWiki. Включает трекер «Чеховских ружей» и сюжетных предметов (`ChekhovGunTracker`) с разбивкой по статусам жизненного цикла, а также матрицу перекрёстных ссылок и присутствия сущностей по главам (`CrossReferenceMatrix`).

---

## 📁 Структура папок и файлов

```
apps/spa/src/ts/features/analytics/
├── README_Analytics.md                 # Данная документация подсистемы аналитики
│
├── ChekhovGunTracker/                  # Канбан-трекер Чеховских ружей и сюжетных предметов
│   ├── ChekhovGunTracker.vue           # Главный UI трекера (колонки статусов и фильтры)
│   ├── ChekhovGunTracker.model.ts      # Типы TrackedItem, ItemUsageState, GunTrackerScope, GunTrackerFilterState
│   ├── useChekhovGunTracker.ts         # Логика загрузки, фильтрации и навигации к главам/цитатам
│   ├── chekhovGunTracker.utils.ts      # Чистые функции группировки и расчёта статусов
│   ├── components/
│   │   ├── ChekhovTrackerToolbar/      # Панель поиска, выбора тома и области (guns / items / all)
│   │   ├── GunStatusColumn/            # Колонка статуса (active / sleeping / forgotten / destroyed)
│   │   ├── GunItemCard/                # Карточка предмета/ружья
│   │   └── GunJourneyModal/            # Модальное окно пути предмета по главам и истории владения
│   └── __tests__/ & *.spec.ts          # Юнит-тесты компонента, хуков и утилит
│
└── CrossReferenceMatrix/               # Матрица присутствия сущностей в главах рукописи
    ├── CrossReferenceMatrix.vue        # Главная таблица матрицы (строки — сущности, столбцы — главы)
    ├── CrossReferenceMatrix.model.ts   # Типы AppearanceStatus, CellStatusInfo, EntityPresenceRow, ChapterColumnSummary
    ├── useCrossReferenceMatrix.ts      # Загрузка данных из analytics.store.ts и фильтрация матрицы
    ├── crossReferenceMatrix.utils.ts   # Построение строк присутствия и детекция разрывов (hasGapWarning)
    ├── components/
    │   ├── MatrixToolbar/              # Панель фильтров (поиск, тип сущности, том, погибшие, подсветка разрывов)
    │   └── MatrixLegend/               # Легенда статусов (scene / mention / both / deceased / absent)
    └── *.spec.ts                       # Юнит-тесты матрицы, хуков и утилит
```

---

## 🏛️ Архитектурные связи

- **Хранилище**: `analytics.store.ts` (вызывает бэкенд-сервисы `ItemTrackerService` и `CrossReferenceMatrixService` через `api.client.ts`).
- **Навигация**: `ChekhovGunTracker` эмитит события `select-item`, `jump-to-chapter` и `locate-promise` (`LocatePromisePayload`) для мгновенного перехода к нужному абзацу в редакторе глав.

---

## 🧪 Тестирование

```bash
pnpm test apps/spa/src/ts/features/analytics
```
