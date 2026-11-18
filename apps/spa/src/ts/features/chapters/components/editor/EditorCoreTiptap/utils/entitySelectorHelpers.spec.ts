import { describe, it, expect } from 'vitest';
import {
  extractCleanTags,
  extractAliases,
  mapRawEntityToSelectorItem
} from './entitySelectorHelpers';
import type { EntitySelectorItem, EntityTypeItem } from '../EntityLinkSelector.model';

describe('entitySelectorHelpers', () => {
  describe('extractCleanTags', () => {
    it('extracts and deduplicates tags from arrays, JSON strings, CSV strings, and objects', () => {
      expect(extractCleanTags(null)).toEqual([]);
      expect(extractCleanTags(['#герой', '  маг ', { name: '#орден' }, { title: 'север' }, { id: '#id1' }, null, {}])).toEqual([
        'герой',
        'маг',
        'орден',
        'север',
        'id1'
      ]);
      expect(extractCleanTags('["#alpha", "beta", "alpha"]')).toEqual(['alpha', 'beta']);
      expect(extractCleanTags('[not-json, #tag2]')).toEqual(['[not-json', 'tag2]']);
      expect(extractCleanTags('{"a":1}')).toEqual(['{"a":1}']);
      expect(extractCleanTags(' [123] ')).toEqual([]);
      expect(extractCleanTags('#one, two, #one')).toEqual(['one', 'two']);
    });
  });

  describe('extractAliases', () => {
    it('collects aliases from arrays and CSV strings across primary and attribute fields', () => {
      expect(extractAliases(undefined)).toEqual([]);
      expect(
        extractAliases(['Лис', '  '], {
          aliases: 'Тень, Лис',
          'псевдонимы': ['Странник'],
          'алиасы': 'Клинок, '
        })
      ).toEqual(['Лис', 'Тень', 'Странник', 'Клинок']);
    });
  });

  describe('mapRawEntityToSelectorItem', () => {
    it('maps entity fields, name fallbacks, schema metadata, tags, and aliases', () => {
      const schemaMap = new Map<string, EntityTypeItem>([
        ['character', { key: 'character', name: 'Персонаж', icon: '🧑' }]
      ]);

      const fromName = mapRawEntityToSelectorItem(
        {
          id: 'entities:c1',
          name: 'Алиса',
          entity_type: 'character',
          tags: ['#гг'],
          attributes: {
            tags: 'магия',
            'псевдонимы': ['Аля']
          }
        } as unknown as EntitySelectorItem,
        schemaMap
      );

      expect(fromName).toMatchObject({
        id: 'entities:c1',
        shortId: 'c1',
        name: 'Алиса',
        entity_type: 'character',
        type_name: 'Персонаж',
        type_icon: '🧑',
        cleanTags: ['гг', 'магия'],
        aliases: ['Аля']
      });

      const fromTitle = mapRawEntityToSelectorItem(
        { id: '', title: 'Замок', type: 'location' } as unknown as EntitySelectorItem,
        schemaMap
      );
      expect(fromTitle).toMatchObject({
        shortId: '',
        name: 'Замок',
        entity_type: 'location',
        type_name: 'location',
        type_icon: '📌'
      });

      const fromFio = mapRawEntityToSelectorItem(
        { fio: 'Иван Петров' } as unknown as EntitySelectorItem,
        schemaMap
      );
      expect(fromFio.name).toBe('Иван Петров');

      const fallback = mapRawEntityToSelectorItem({} as unknown as EntitySelectorItem, schemaMap);
      expect(fallback).toMatchObject({
        name: 'Без названия',
        entity_type: 'unknown'
      });
    });
  });
});
