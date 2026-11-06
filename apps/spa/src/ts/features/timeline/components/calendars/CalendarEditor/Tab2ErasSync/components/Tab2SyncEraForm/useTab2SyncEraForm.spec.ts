import { describe, it, expect } from 'vitest';
import { useTab2SyncEraForm } from './useTab2SyncEraForm';
import type { Tab2SyncEraFormProps } from './Tab2SyncEraForm.model';

describe('useTab2SyncEraForm', () => {
  const props: Tab2SyncEraFormProps = {
    selectedMasterEraIndex: 0,
    masterEras: [
      { id: 'era_1', название: 'Первая Эпоха', год_начала: 1, направление: 'вперёд' },
      { id: 'era_2', название: 'Вторая Эпоха', год_начала: 1000, направление: 'вперёд' },
    ],
    offsetDirection: 'after',
    offsetYears: 10,
  };

  it('computes eraOptions with default root era and masterEras', () => {
    const { eraOptions } = useTab2SyncEraForm(props);
    expect(eraOptions.value).toHaveLength(3);
    expect(eraOptions.value[0]).toEqual({
      value: '-1',
      label: '🌍 От начала Календаря Мира (Год 1)',
    });
    expect(eraOptions.value[1]).toEqual({
      value: '0',
      label: '🏛️ Первая Эпоха (с 1 г.)',
    });
    expect(eraOptions.value[2]).toEqual({
      value: '1',
      label: '🏛️ Вторая Эпоха (с 1000 г.)',
    });
  });
});

