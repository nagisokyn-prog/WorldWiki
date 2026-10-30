import { describe, it, expect, vi } from 'vitest';
import { useCommandPalette } from '../useCommandPalette';

describe('useCommandPalette', () => {
  it('initializes with localized russian builtin commands', () => {
    const emit = vi.fn();
    const palette = useCommandPalette({}, emit as any);

    expect(palette.filtered.value.length).toBeGreaterThan(0);
    const titles = palette.filtered.value.map(c => c.title);
    expect(titles).toContain('Сохранить всё');
    expect(titles).toContain('Новая глава');
    expect(titles).toContain('Создать сущность');
    expect(titles).toContain('Быстрый переход');
    expect(titles).toContain('Настройки приложения');
    expect(titles).toContain('Показать / скрыть боковую панель');
    expect(titles).toContain('Показать / скрыть терминал');
  });

  it('filters commands by query and keywords', () => {
    const emit = vi.fn();
    const palette = useCommandPalette({}, emit as any);

    palette.query.value = 'глава';
    expect(palette.filtered.value.some(c => c.title === 'Новая глава')).toBe(true);

    palette.query.value = 'terminal';
    expect(palette.filtered.value.some(c => c.title === 'Показать / скрыть терминал')).toBe(true);

    palette.query.value = 'несуществующая_команда_xyz';
    expect(palette.filtered.value.length).toBe(0);
  });

  it('cycles navigation with moveDown and moveUp', () => {
    const emit = vi.fn();
    const palette = useCommandPalette({
      commands: [
        { id: '1', title: 'Первая', desc: 'Тест 1', icon: '1', action: vi.fn() },
        { id: '2', title: 'Вторая', desc: 'Тест 2', icon: '2', action: vi.fn() },
        { id: '3', title: 'Третья', desc: 'Тест 3', icon: '3', action: vi.fn() }
      ],
      disableBuiltins: true
    }, emit as any);

    expect(palette.activeIdx.value).toBe(0);

    // Вниз -> 1
    palette.moveDown();
    expect(palette.activeIdx.value).toBe(1);

    // Вниз -> 2
    palette.moveDown();
    expect(palette.activeIdx.value).toBe(2);

    // Циклический переход вниз с конца -> 0
    palette.moveDown();
    expect(palette.activeIdx.value).toBe(0);

    // Циклический переход вверх с начала -> 2
    palette.moveUp();
    expect(palette.activeIdx.value).toBe(2);
  });

  it('executes active command and closes palette on runActive', () => {
    const actionSpy = vi.fn();
    const emit = vi.fn();
    const palette = useCommandPalette({
      commands: [
        { id: 'custom', title: 'Моя команда', desc: 'Описание', icon: '⭐', action: actionSpy }
      ],
      disableBuiltins: true
    }, emit as any);

    palette.open();
    expect(palette.isOpen.value).toBe(true);

    palette.runActive();
    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(palette.isOpen.value).toBe(false);
  });
});

