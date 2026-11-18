import { describe, it, expect } from 'vitest';
import {
  normalizeCleanId,
  getRoleWeight,
  formatWordCount,
  getEntityIcon,
  getEntityTypeLabel,
  buildEntityPresenceRow,
  buildChapterColumns,
} from './crossReferenceMatrix.utils';

describe('crossReferenceMatrix.utils', () => {
  it('normalizes ids from strings, RecordId objects, and empty values', () => {
    expect(normalizeCleanId()).toBe('');
    expect(normalizeCleanId(null)).toBe('');
    expect(normalizeCleanId('⟨entities:hero_1⟩')).toBe('hero_1');
    expect(normalizeCleanId({ id: 'chapters:ch_1' })).toBe('ch_1');
    expect(normalizeCleanId({ String: 'entities:npc_2' })).toBe('npc_2');
    expect(normalizeCleanId({ foo: 'bar' })).toBe('');
  });

  it('computes role weights and formats word counts', () => {
    expect(getRoleWeight()).toBe(1);
    expect(getRoleWeight('Главный герой')).toBe(4);
    expect(getRoleWeight('antagonist')).toBe(3);
    expect(getRoleWeight('второстепенный')).toBe(2);
    expect(getRoleWeight('массовка')).toBe(1);

    expect(formatWordCount(0)).toBe('0 сл.');
    expect(formatWordCount(null)).toBe('0 сл.');
    expect(formatWordCount(450)).toBe('450 сл.');
    expect(formatWordCount(2500)).toBe('2.5k сл.');
  });

  it('maps entity icons and type labels across all variants', () => {
    const cases: Array<[string | null | undefined, string, string]> = [
      ['character', '👤', 'персонаж'],
      ['Персонаж', '👤', 'персонаж'],
      ['item', '🗡️', 'предмет'],
      ['артефакт', '🗡️', 'предмет'],
      ['location', '📍', 'локация'],
      ['Локация', '📍', 'локация'],
      ['faction', '👥', 'фракция'],
      ['Фракция', '👥', 'фракция'],
      ['event', '⌛', 'событие'],
      ['Событие', '⌛', 'событие'],
      ['custom', '🏷️', 'custom'],
      [null, '🏷️', 'сущность'],
    ];
    for (const [type, icon, label] of cases) {
      expect(getEntityIcon(type)).toBe(icon);
      expect(getEntityTypeLabel(type)).toBe(label);
    }
  });

  it('builds entity presence row across scene, mention, both, deceased, absent, and gap warning', () => {
    const chapters = [
      { id: 'chapters:1', sort_order: 1, title: 'Г1', word_count: 500 },
      { id: 'chapters:2', sort_order: 2, title: 'Г2', word_count: 1000 },
      { id: 'chapters:3', sort_order: 3, title: 'Г3', word_count: 0 },
      { id: '4', sort_order: 4, title: 'Г4', word_count: 200 },
      { id: 'chapters:5', sort_order: 5, title: 'Г5', word_count: 300 },
      { id: 'chapters:6', sort_order: 6, title: 'Г6', word_count: 300 },
    ] as any[];

    const row = buildEntityPresenceRow(
      {
        entity_id: 'ent:1',
        entity_name: 'Герой',
        entity_type: 'character',
        is_deceased: true,
        appearances: [
          { chapter_id: '', kind: 'scene' },
          { chapter_id: 'chapters:1', has_scene: true, has_mention: true, count: 2, role: 'Главный' },
          { chapter_id: 'chapters:2', source: 'mention' },
          { chapter_id: 'chapters:6', kind: 'deceased', count: 1 },
        ],
      } as any,
      chapters
    );

    expect(row.cells.get('chapters:1')?.status).toBe('both');
    expect(row.cells.get('1')?.role).toBe('Главный');
    expect(row.cells.get('chapters:2')?.status).toBe('mention');
    expect(row.cells.get('chapters:3')?.status).toBe('deceased'); // dead after last seen
    expect(row.cells.get('chapters:6')?.status).toBe('deceased');
    expect(row.hasGapWarning).toBe(true); // gap of 3 chapters (3, 4, 5)
    expect(row.totalAppearances).toBe(4);

    const sceneOnlyRow = buildEntityPresenceRow(
      {
        entity_id: 'ent:2',
        entity_name: 'NPC',
        entity_type: 'item',
        appearances_by_chapter: [{ chapter_id: '4', source: 'manual', count: 1 }],
      } as any,
      chapters
    );
    expect(sceneOnlyRow.cells.get('4')?.status).toBe('scene');
    expect(sceneOnlyRow.cells.get('chapters:1')?.status).toBe('absent');

    const emptyRow = buildEntityPresenceRow({ entity_id: 'ent:3', entity_name: 'X' } as any, chapters);
    expect(emptyRow.totalAppearances).toBe(0);
  });

  it('builds chapter columns with fallback stats and sort_order bounds', () => {
    const stats = new Map([['chapters:1', { scenes: 2, mentions: 1, total: 3 }]]);
    const cols = buildChapterColumns(
      [
        { id: 'chapters:1', sort_order: 1, title: 'А', word_count: 1200 },
        { id: 'chapters:2', sort_order: 0, title: 'Б', word_count: 0 },
        { id: 'chapters:3', sort_order: 1500, title: 'В', word_count: 50 },
      ] as any[],
      stats
    );
    expect(cols[0].sort_order).toBe(1);
    expect(cols[0].uniqueEntities).toBe(3);
    expect(cols[0].formattedWordCount).toBe('1.2k сл.');
    expect(cols[1].sort_order).toBe(2);
    expect(cols[1].uniqueEntities).toBe(0);
    expect(cols[2].sort_order).toBe(3);
  });
});
