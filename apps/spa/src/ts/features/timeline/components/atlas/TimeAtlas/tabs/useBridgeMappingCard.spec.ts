import { describe, it, expect } from 'vitest';
import { reactive } from 'vue';
import { useBridgeMappingCard } from './useBridgeMappingCard';
import type { BridgeMappingCardProps } from './BridgeMappingCard.model';

describe('useBridgeMappingCard', () => {
  it('returns localDate when provided and fallback default otherwise', () => {
    const props = reactive({
      localDate: { era_index: 2, year: 120, month: 3, day: 15, hour: 6, minute: 30 }
    }) as unknown as BridgeMappingCardProps;

    const card = useBridgeMappingCard(props);
    expect(card.safeDate.value).toEqual({
      era_index: 2,
      year: 120,
      month: 3,
      day: 15,
      hour: 6,
      minute: 30
    });

    props.localDate = null;
    expect(card.safeDate.value).toEqual({
      era_index: 0,
      year: 1,
      month: 0,
      day: 1,
      hour: 0,
      minute: 0
    });
  });
});

