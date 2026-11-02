import { describe, it, expect } from 'vitest';
import { useAuditAnomalyCard } from './useAuditAnomalyCard';
import type { ContradictionAnomalyDto } from '../ConsistencyChecker.model';

describe('useAuditAnomalyCard Composable', () => {
  it('returns correct rule emoji based on rule name', () => {
    const makeAnomaly = (rule: string): ContradictionAnomalyDto => ({
      rule,
      severity: 'critical',
      title: 'Test',
      description: 'Desc',
      entity_ids: ['entities:art'],
      chapter_ids: ['chapters:ch1'],
      event_ids: [],
      promise_ids: [],
    });

    expect(useAuditAnomalyCard(() => makeAnomaly('deceased_entity_active')).ruleEmoji.value).toBe('💀');
    expect(useAuditAnomalyCard(() => makeAnomaly('action_before_birth')).ruleEmoji.value).toBe('👶');
    expect(useAuditAnomalyCard(() => makeAnomaly('entity_bilocation')).ruleEmoji.value).toBe('⚡');
    expect(useAuditAnomalyCard(() => makeAnomaly('reveal_before_event')).ruleEmoji.value).toBe('🔄');
    expect(useAuditAnomalyCard(() => makeAnomaly('forgotten_plot_promise')).ruleEmoji.value).toBe('⏳');
    expect(useAuditAnomalyCard(() => makeAnomaly('destroyed_location_used')).ruleEmoji.value).toBe('🏰');
    expect(useAuditAnomalyCard(() => makeAnomaly('unknown_rule')).ruleEmoji.value).toBe('⚠️');
  });

  it('cleans ID prefixes correctly', () => {
    const anomaly: ContradictionAnomalyDto = {
      rule: 'test',
      severity: 'notice',
      title: 'Test',
      description: 'Desc',
      entity_ids: [],
      chapter_ids: [],
      event_ids: [],
      promise_ids: [],
    };
    const { cleanId } = useAuditAnomalyCard(() => anomaly);
    expect(cleanId('entities:arthur')).toBe('arthur');
    expect(cleanId('chapters:ch_1')).toBe('ch_1');
    expect(cleanId('timeline_events:ev_1')).toBe('ev_1');
    expect(cleanId('plot_promises:p_1')).toBe('p_1');
    expect(cleanId('')).toBe('');
  });

  it('deduplicates entity_ids and chapter_ids and formats labels', () => {
    const anomaly: ContradictionAnomalyDto = {
      rule: 'entity_bilocation',
      severity: 'warning',
      title: 'Test',
      description: 'Desc',
      entity_ids: ['entities:art', 'entities:art'],
      chapter_ids: ['chapters:ch_1', 'chapters:ch_1'],
      event_ids: [],
      promise_ids: [],
    };
    const { uniqueEntityIds, uniqueChapterIds, getEntityLabel, getChapterLabel } = useAuditAnomalyCard(() => anomaly);
    expect(uniqueEntityIds.value).toEqual(['entities:art']);
    expect(uniqueChapterIds.value).toEqual(['chapters:ch_1']);
    expect(getEntityLabel('entities:art')).toBe('art');
    expect(getChapterLabel('chapters:ch_1')).toBe('ch_1');
  });
});
