# 🎨 ПРАВИЛО 05: СТИЛИ, ДИЗАЙН-ТОКЕНЫ И UI-KIT

> **ОБЛАСТЬ ДЕЙСТВИЯ**: Все `.vue` и `.css` файлы репозитория.
> **СТАТУС**: КРИТИЧЕСКИЙ (0 толерантность к CSS-хардкоду).

---

## 1. Абсолютный запрет хардкода цветов и размеров

Строго запрещено использовать в `<style>` и инлайн `style=""`:
* ❌ Hex-цвета: `#fff`, `#000000`, `#3b82f6`, `#0f1218`, `#RRGGBB`.
* ❌ Именованные цвета: `red`, `blue`, `black`, `white`, `gray`.
* ❌ Прямые вызовы `rgba(0,0,0,0.5)` / `rgba(255,255,255,0.1)`.
* ❌ Захардкоженные радиусы: `border-radius: 8px`, `border-radius: 4px`.

### ✅ Эталонное использование токенов:
```css
/* ПРАВИЛЬНО: */
color: var(--color-text-primary);
background: var(--color-bg-primary);
border: 1px solid var(--glass-border);
backdrop-filter: var(--glass-blur);
border-radius: var(--border-radius-md);
transition: all var(--transition-normal);
```

---

## 2. Запрет TailwindCSS

В проекте используется **ТОЛЬКО Scoped Vanilla CSS** с CSS Custom Properties дизайн-системы. Никаких утилитных классов Tailwind.

---

## 3. Правило переиспользования UI-Kit (`@worldwiki/components`)

Запрещено клонировать и заново писать базовые элементы интерфейса внутри `apps/spa`.
Все базовые компоненты берутся **СТРОГО** из `@worldwiki/components`:
* Кнопки (`AppButton`)
* Диалоги и модалки (`AppDialog`, `DialogModal`)
* Тулбары и выпадающие списки
* Деревья навигации (`ExplorerTree`)
* Колёса прокрутки (`XboxWheel`)
* Теги и поля ввода (`TagsField`, `AppInput`)

Если нужного UI-компонента нет — он создаётся в `packages/components`, экспортируется в `src/index.ts` и только затем подключается в `apps/spa`.
