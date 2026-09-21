# 🛡️ Cerberus CSS !important Context Analysis Report

> Дата генерации: 2026-09-21T09:02:42.083Z | Время анализа: **101 ms**

### 📊 Сводка

| Метрика | Значение |
|---|---|
| **Всего `!important`** | **27** |
| **Затронуто файлов** | **3** |
| **Third-party Overrides** | 22 |
| **JS Inline-Style Conflicts** | 0 |
| **Utility Classes** | 1 |
| **Self-Cascade Conflicts** | 0 |
| **Local Overrides** | 4 |

### 📋 Детальный реестр нарушений

#### 1. `packages/resources/src/styles/base/layout.css:70`
- **Селектор**: `body.no-glass-blur,body.no-glass-blur *,body.no-glass-blur *::before,body.no-glass-blur *::after`
- **Свойство**: `backdrop-filter: none !important`
- **Специфичность**: `0,4,3` (score: 43)
- **Категория**: `LOCAL_CASCADE_OVERRIDE` (Confidence: **LOW**)
- **Причина**: Принудительное переопределение специфичности (0,4,3)
- **Рекомендация**: Убрать !important и реорганизовать селектор с большей специфичностью

#### 2. `packages/resources/src/styles/base/layout.css:71`
- **Селектор**: `body.no-glass-blur,body.no-glass-blur *,body.no-glass-blur *::before,body.no-glass-blur *::after`
- **Свойство**: `-webkit-backdrop-filter: none !important`
- **Специфичность**: `0,4,3` (score: 43)
- **Категория**: `LOCAL_CASCADE_OVERRIDE` (Confidence: **LOW**)
- **Причина**: Принудительное переопределение специфичности (0,4,3)
- **Рекомендация**: Убрать !important и реорганизовать селектор с большей специфичностью

#### 3. `packages/resources/src/styles/base/reset.css:12`
- **Селектор**: `[v-cloak]`
- **Свойство**: `display: none !important`
- **Специфичность**: `0,1,0` (score: 10)
- **Категория**: `UTILITY_CLASS` (Confidence: **HIGH**)
- **Причина**: Утилитарный класс для управления состоянием DOM ([v-cloak])
- **Рекомендация**: Вынести в @layer utilities { [v-cloak] { display: none; } } без !important

#### 4. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:162`
- **Селектор**: `.ProseMirror a`
- **Свойство**: `cursor: pointer !important`
- **Специфичность**: `0,1,1` (score: 11)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a) или перенести в @layer third-party

#### 5. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:178`
- **Селектор**: `.ProseMirror a[href*="ui_editor"], .ProseMirror a[href^="entity:"], .ProseMirror a[href*="project="], .ProseMirror a.entity-link`
- **Свойство**: `color: var(--accent) !important`
- **Специфичность**: `0,8,4` (score: 84)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href*="ui_editor"], .ProseMirror a[href^="entity:"], .ProseMirror a[href*="project="], .ProseMirror a.entity-link) или перенести в @layer third-party

#### 6. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:184`
- **Селектор**: `.ProseMirror a[href*="ui_editor"], .ProseMirror a[href^="entity:"], .ProseMirror a[href*="project="], .ProseMirror a.entity-link`
- **Свойство**: `text-decoration: none !important`
- **Специфичность**: `0,8,4` (score: 84)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href*="ui_editor"], .ProseMirror a[href^="entity:"], .ProseMirror a[href*="project="], .ProseMirror a.entity-link) или перенести в @layer third-party

#### 7. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:204`
- **Селектор**: `.ProseMirror a[href*="ui_editor"]:hover, .ProseMirror a[href^="entity:"]:hover, .ProseMirror a[href*="project="]:hover, .ProseMirror a.entity-link:hover`
- **Свойство**: `background: var(--accent) !important`
- **Специфичность**: `0,12,4` (score: 124)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href*="ui_editor"]:hover, .ProseMirror a[href^="entity:"]:hover, .ProseMirror a[href*="project="]:hover, .ProseMirror a.entity-link:hover) или перенести в @layer third-party

#### 8. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:205`
- **Селектор**: `.ProseMirror a[href*="ui_editor"]:hover, .ProseMirror a[href^="entity:"]:hover, .ProseMirror a[href*="project="]:hover, .ProseMirror a.entity-link:hover`
- **Свойство**: `color: var(--accent-text) !important`
- **Специфичность**: `0,12,4` (score: 124)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href*="ui_editor"]:hover, .ProseMirror a[href^="entity:"]:hover, .ProseMirror a[href*="project="]:hover, .ProseMirror a.entity-link:hover) или перенести в @layer third-party

#### 9. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:215`
- **Селектор**: `.ProseMirror a[href^="http://"], .ProseMirror a[href^="https://"], .ProseMirror a.web-link`
- **Свойство**: `color: var(--info) !important`
- **Специфичность**: `0,6,3` (score: 63)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href^="http://"], .ProseMirror a[href^="https://"], .ProseMirror a.web-link) или перенести в @layer third-party

#### 10. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:232`
- **Селектор**: `.ProseMirror a[href^="http://"]:hover, .ProseMirror a[href^="https://"]:hover, .ProseMirror a.web-link:hover`
- **Свойство**: `color: var(--info) !important`
- **Специфичность**: `0,9,3` (score: 93)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href^="http://"]:hover, .ProseMirror a[href^="https://"]:hover, .ProseMirror a.web-link:hover) или перенести в @layer third-party

#### 11. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:240`
- **Селектор**: `.ProseMirror a[href^="#fn"], .ProseMirror a.footnote-ref`
- **Свойство**: `color: var(--warning) !important`
- **Специфичность**: `1,4,2` (score: 142)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href^="#fn"], .ProseMirror a.footnote-ref) или перенести в @layer third-party

#### 12. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:244`
- **Селектор**: `.ProseMirror a[href^="#fn"], .ProseMirror a.footnote-ref`
- **Свойство**: `text-decoration: none !important`
- **Специфичность**: `1,4,2` (score: 142)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href^="#fn"], .ProseMirror a.footnote-ref) или перенести в @layer third-party

#### 13. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:254`
- **Селектор**: `.ProseMirror a[href^="#fn"]:hover, .ProseMirror a.footnote-ref:hover`
- **Свойство**: `background: var(--warning) !important`
- **Специфичность**: `1,6,2` (score: 162)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href^="#fn"]:hover, .ProseMirror a.footnote-ref:hover) или перенести в @layer third-party

#### 14. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:255`
- **Селектор**: `.ProseMirror a[href^="#fn"]:hover, .ProseMirror a.footnote-ref:hover`
- **Свойство**: `color: var(--accent-text) !important`
- **Специфичность**: `1,6,2` (score: 162)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.ProseMirror a[href^="#fn"]:hover, .ProseMirror a.footnote-ref:hover) или перенести в @layer third-party

#### 15. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:261`
- **Селектор**: `.link-lock-active .ProseMirror a`
- **Свойство**: `cursor: pointer !important`
- **Специфичность**: `0,2,1` (score: 21)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.link-lock-active .ProseMirror a) или перенести в @layer third-party

#### 16. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:372`
- **Селектор**: `.editor-content-word-sheet .ProseMirror .word-table-caption`
- **Свойство**: `text-indent: 0 !important`
- **Специфичность**: `0,3,0` (score: 30)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.editor-content-word-sheet .ProseMirror .word-table-caption) или перенести в @layer third-party

#### 17. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:382`
- **Селектор**: `.editor-content-word-sheet .ProseMirror .word-figure-caption`
- **Свойство**: `text-indent: 0 !important`
- **Специфичность**: `0,3,0` (score: 30)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.editor-content-word-sheet .ProseMirror .word-figure-caption) или перенести в @layer third-party

#### 18. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:389`
- **Селектор**: `.rk-editor-mount .ProseMirror .gost-table-caption`
- **Свойство**: `text-indent: 0 !important`
- **Специфичность**: `0,3,0` (score: 30)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror .gost-table-caption) или перенести в @layer third-party

#### 19. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:398`
- **Селектор**: `.rk-editor-mount .ProseMirror .gost-figure-caption`
- **Свойство**: `text-indent: 0 !important`
- **Специфичность**: `0,3,0` (score: 30)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror .gost-figure-caption) или перенести в @layer third-party

#### 20. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:414`
- **Селектор**: `.word-mode-active .semantic-tag-badge, .editor-wrapper-word-page .semantic-tag-badge`
- **Свойство**: `display: none !important`
- **Специфичность**: `0,4,0` (score: 40)
- **Категория**: `LOCAL_CASCADE_OVERRIDE` (Confidence: **LOW**)
- **Причина**: Принудительное переопределение специфичности (0,4,0)
- **Рекомендация**: Убрать !important и реорганизовать селектор с большей специфичностью

#### 21. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:419`
- **Селектор**: `.word-mode-active .semantic-paragraph-node, .editor-wrapper-word-page .semantic-paragraph-node`
- **Свойство**: `padding-left: 0 !important`
- **Специфичность**: `0,4,0` (score: 40)
- **Категория**: `LOCAL_CASCADE_OVERRIDE` (Confidence: **LOW**)
- **Причина**: Принудительное переопределение специфичности (0,4,0)
- **Рекомендация**: Убрать !important и реорганизовать селектор с большей специфичностью

#### 22. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:452`
- **Селектор**: `.rk-editor-mount .ProseMirror p`
- **Свойство**: `margin-top: 0 !important`
- **Специфичность**: `0,2,1` (score: 21)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror p) или перенести в @layer third-party

#### 23. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:453`
- **Селектор**: `.rk-editor-mount .ProseMirror p`
- **Свойство**: `margin-bottom: 0 !important`
- **Специфичность**: `0,2,1` (score: 21)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror p) или перенести в @layer third-party

#### 24. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:464`
- **Селектор**: `.rk-editor-mount .ProseMirror h1, .rk-editor-mount .ProseMirror h2, .rk-editor-mount .ProseMirror h3, .rk-editor-mount .ProseMirror h4, .rk-editor-mount .ProseMirror h5, .rk-editor-mount .ProseMirror h6`
- **Свойство**: `margin-top: 0 !important`
- **Специфичность**: `0,12,6` (score: 126)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror h1, .rk-editor-mount .ProseMirror h2, .rk-editor-mount .ProseMirror h3, .rk-editor-mount .ProseMirror h4, .rk-editor-mount .ProseMirror h5, .rk-editor-mount .ProseMirror h6) или перенести в @layer third-party

#### 25. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:465`
- **Селектор**: `.rk-editor-mount .ProseMirror h1, .rk-editor-mount .ProseMirror h2, .rk-editor-mount .ProseMirror h3, .rk-editor-mount .ProseMirror h4, .rk-editor-mount .ProseMirror h5, .rk-editor-mount .ProseMirror h6`
- **Свойство**: `margin-bottom: 0 !important`
- **Специфичность**: `0,12,6` (score: 126)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror h1, .rk-editor-mount .ProseMirror h2, .rk-editor-mount .ProseMirror h3, .rk-editor-mount .ProseMirror h4, .rk-editor-mount .ProseMirror h5, .rk-editor-mount .ProseMirror h6) или перенести в @layer third-party

#### 26. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:474`
- **Селектор**: `.rk-editor-mount .ProseMirror blockquote p, .rk-editor-mount .ProseMirror li p, .rk-editor-mount .ProseMirror li`
- **Свойство**: `margin-top: 0 !important`
- **Специфичность**: `0,6,5` (score: 65)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror blockquote p, .rk-editor-mount .ProseMirror li p, .rk-editor-mount .ProseMirror li) или перенести в @layer third-party

#### 27. `packages/resources/src/styles/features/chapters/EditorCoreTiptap.css:475`
- **Селектор**: `.rk-editor-mount .ProseMirror blockquote p, .rk-editor-mount .ProseMirror li p, .rk-editor-mount .ProseMirror li`
- **Свойство**: `margin-bottom: 0 !important`
- **Специфичность**: `0,6,5` (score: 65)
- **Категория**: `THIRD_PARTY_OVERRIDE` (Confidence: **HIGH**)
- **Причина**: Перебивает дефолтные стили библиотеки: Tiptap / ProseMirror Editor
- **Рекомендация**: Изолировать в *.override.css, использовать :deep(.rk-editor-mount .ProseMirror blockquote p, .rk-editor-mount .ProseMirror li p, .rk-editor-mount .ProseMirror li) или перенести в @layer third-party

