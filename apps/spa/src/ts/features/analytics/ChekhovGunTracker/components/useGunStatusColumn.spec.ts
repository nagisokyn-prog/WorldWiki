import { describe, it, expect } from 'vitest';
import { useGunStatusColumn } from './useGunStatusColumn';
import type { GunStatusColumnProps } from '../ChekhovGunTracker.model';

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
});
