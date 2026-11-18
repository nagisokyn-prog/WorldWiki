import { describe, it, expect } from 'vitest';
import { getPhaseLabel, extractBirthMabs, buildTimelineItems } from './useJourneyItemsBuilder';
import { CalendarFormat } from '@/services/Calendars/calendar.format';

describe('useJourneyItemsBuilder', () => {
  const cal = CalendarFormat.getDefaultCalendar();

  it('returns labels for all phases', () => {
    expect(getPhaseLabel('setup')).toBe('🌱 Завязка');
    expect(getPhaseLabel('escalation')).toBe('⚡ Эскалация');
    expect(getPhaseLabel('climax')).toBe('🔥 Кульминация');
    expect(getPhaseLabel('resolution')).toBe('✅ Развязка');
    expect(getPhaseLabel(null)).toBe('🌱 Сцена');
  });

  it('extracts birth_m_abs from numeric, object, or missing attributes', () => {
    expect(extractBirthMabs(null, cal)).toBeNull();
    expect(extractBirthMabs({ attributes: { birth_m_abs: 500 } } as any, cal)).toBe(500);
    expect(extractBirthMabs({ attributes: { birth_date: 1200 } } as any, cal)).toBe(1200);
    expect(extractBirthMabs({ attributes: { дата_рождения: { year: 2, month: 0, day: 1 } } } as any, cal)).toBeTypeOf('number');
    expect(extractBirthMabs({ attributes: {} } as any, cal)).toBeNull();
  });

  it('builds timeline items across appearances, events, relations, and promises with fallbacks', () => {
    expect(buildTimelineItems(null, [], cal)).toEqual([]);

    const items = buildTimelineItems(
      {
        entity_id: 'ent:1',
        entity_name: 'Герой',
        entity_type: 'character',
        attributes: {},
        appearances: [
          { chapter_id: 'chapters:1', chapter_order: 1, source: 'scene', paragraph_index: 5, block_id: 'para-5' },
          { chapter_id: 'chapters:2', chapter_order: 2, source: 'scene', role: 'Камео' },
          { chapter_id: 'chapters:3', source: 'mention', chapter_title: 'Финал' },
        ],
        events: [
          { event_id: 'ev1', event_title: 'Событие', event_desc: 'Описание', quote: '...', m_abs: 100 },
        ],
        relations: [
          { id: 'r1', target_id: 'ent:2', target_name: 'Враг', rel_type: 'rival', strength: -5 },
          { id: 'r2', target_id: 'ent:3', target_name: 'Друг', rel_type: 'ally', start_order: 2, strength: 10 },
        ],
        promises: [
          {
            id: 'p1',
            chapter_id: 'chapters:1',
            paragraph_index: 5,
            block_id: 'para-5',
            status: 'resolved',
            quote: 'Очень длинная цитата для проверки обрезки текста свыше сорока пяти символов в интерфейсе',
          },
          {
            id: 'p2',
            title: 'Короткий заголовок',
            block_id: 'para-12',
            status: 'planted',
            planted_order: 3,
            date_fields: { year: 1, month: 0, day: 1 },
          },
        ],
      } as any,
      [],
      null
    );

    // Duplicate scene appearance for chapter 1 skipped
    expect(items.filter((i) => i.type === 'appearance')).toHaveLength(2);
    expect(items.find((i) => i.id.startsWith('ev-'))).toBeDefined();
    expect(items.find((i) => i.id === 'rel-r1')?.badgeType).toBe('danger');
    expect(items.find((i) => i.id === 'rel-r2')?.badgeType).toBe('success');
    expect(items.find((i) => i.id === 'prom-p1')?.badge).toBe('Разрешено');
    expect(items.find((i) => i.id === 'prom-p2')?.paragraph_index).toBe(12);
  });
});
