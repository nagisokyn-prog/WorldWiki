import { describe, it, expect } from 'vitest';
import { useGunStatusColumn } from './useGunStatusColumn';
import type { GunStatusColumnProps } from '../../ChekhovGunTracker.model';

describe('useGunStatusColumn Composable', () => {
  it('correctly calculates item count and empty state', () => {
    const props: GunStatusColumnProps = {
      title: 'В сюжете',
      icon: '🟢',
      stateKey: 'active',
      items: [],
      colorClass: 'text-success',
    };

    const { itemCount, isEmpty, emptyText } = useGunStatusColumn(() => props);

    expect(itemCount.value).toBe(0);
    expect(isEmpty.value).toBe(true);
    expect(emptyText.value).toContain('Нет предметов, активно задействованных');
  });

  it('provides dedicated empty text for guns scope', () => {
    const props: GunStatusColumnProps = {
      title: 'Ждут своего часа',
      icon: '🟡',
      stateKey: 'sleeping',
      items: [],
      colorClass: 'text-warning',
      scope: 'guns',
    };

    const { emptyText } = useGunStatusColumn(() => props);
    expect(emptyText.value).toBe('Нет ружей в режиме ожидания выстрела');
  });

  it('covers all stateKey variants for both guns and items scopes', () => {
    const make = (stateKey: any, scope?: 'guns' | 'items') =>
      useGunStatusColumn(() => ({
        title: 't',
        icon: 'i',
        stateKey,
        items: [],
        colorClass: 'c',
        scope,
      })).emptyText.value;

    expect(make('active', 'guns')).toBe('Нет активных чеховских ружей в текущих главах');
    expect(make('sleeping', 'items')).toBe('Нет артефактов в режиме ожидания');
    expect(make('forgotten', 'guns')).toBe('Отлично! Забытых и невыстреливших ружей не обнаружено');
    expect(make('forgotten', 'items')).toBe('Отлично! Забытых предметов не обнаружено');
    expect(make('destroyed', 'guns')).toBe('Нет сорванных или снятых ружей');
    expect(make('destroyed', 'items')).toBe('Нет уничтоженных или утерянных предметов');
    expect(make('unknown', 'guns')).toBe('Список пуст');
  });
});
