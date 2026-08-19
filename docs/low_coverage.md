# Файлы с покрытием < 50% (приоритет)

Глобальное покрытие сейчас: **76.44%** (цель: 85%)

---

## Реальный код с низким покрытием (приоритет для тестов)

| Файл                        | % Stmts    | Непокрытые строки  |
| --------------------------- | ---------- | ------------------ |
| `AiGhostTextExtension.ts`   | **5%**     | 23-121             |
| `useTiptapEditor.ts`        | **12.5%**  | многие             |
| `timeline-panel.ts`         | **26.95%** | многие             |
| `useCalendarPlayground.ts`  | **37.89%** | 64-145, 153-154    |
| `useChapterLayout.ts`       | **36.27%** | 30-142, 146-151    |
| `useUniversalDatePicker.ts` | **42.93%** | 107-216, 220-234   |
| `useDateWheels.ts`          | **44.23%** | 135-141, 145-147   |
| `useChaptersMain.ts`        | **45.12%** | 27-130, 141-146    |
| `useEntityEditor.ts`        | **45.87%** | 66-267, 279-280    |
| `useTiptapSplitView.ts`     | **48.42%** | 102, 104, 106, 108 |

---

## Порядок работы

1. `AiGhostTextExtension.ts` + `useTiptapEditor.ts` — EditorCoreTiptap (10.59% группа)
2. `timeline-panel.ts` — всё ещё 27%
3. `useChapterLayout.ts` + `useChaptersMain.ts`
4. `useCalendarPlayground.ts`
5. `useUniversalDatePicker.ts` + `useDateWheels.ts`
6. `useEntityEditor.ts`
7. `useTiptapSplitView.ts`
