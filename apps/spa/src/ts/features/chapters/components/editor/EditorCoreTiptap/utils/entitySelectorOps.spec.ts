import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeQuickCreate,
  buildUpdatedEntityTags,
  handleEntityTaggingOnSelect
} from './entitySelectorOps';
import type { EntitySchema } from '@/types/generated/EntitySchema';

const mockSaveEntity = vi.fn();
const mockInvalidateCache = vi.fn();

vi.mock('@/services/api.client', () => ({
  saveEntity: (...args: unknown[]) => mockSaveEntity(...args)
}));

vi.mock('@/utils/requestCache', () => ({
  invalidateCache: (...args: unknown[]) => mockInvalidateCache(...args)
}));

describe('entitySelectorOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeQuickCreate creates entity with schema title field and dispatches events', async () => {
    mockSaveEntity.mockResolvedValueOnce({ id: 'entities:new-1' });
    const events: string[] = [];
    const onSaved = () => events.push('saved');
    const onTags = () => events.push('tags');
    document.addEventListener('ww:entity-saved', onSaved);
    document.addEventListener('ww:tags-updated', onTags);

    const schemas = [
      {
        type_key: 'character',
        full_schema: {
          sections: [{ fields: [{ path: 'имя_персонажа' }] }]
        }
      }
    ] as unknown as EntitySchema[];

    const res = await executeQuickCreate({
      name: 'Алиса',
      chosenType: 'character',
      sourceMention: 'Алька',
      saveAsTag: true,
      project: 'proj-1',
      loadedSchemas: schemas
    });

    expect(res).toEqual({ id: 'entities:new-1', name: 'Алиса', type: 'character' });
    expect(mockSaveEntity).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        name: 'Алиса',
        entity_type: 'character',
        tags: ['Алька']
      })
    );
    expect(mockInvalidateCache).toHaveBeenCalledWith('entities:');
    expect(mockInvalidateCache).toHaveBeenCalledWith('tags:');
    expect(events).toEqual(['saved', 'tags']);

    // Same mention as name + no matching schema -> no tag added, fallback field 'название'
    mockSaveEntity.mockResolvedValueOnce({ id: '' });
    const res2 = await executeQuickCreate({
      name: 'Замок',
      chosenType: 'location',
      sourceMention: 'замок',
      saveAsTag: true,
      project: 'proj-1',
      loadedSchemas: []
    });
    expect(res2).toEqual({ id: '', name: 'Замок', type: 'location' });

    document.removeEventListener('ww:entity-saved', onSaved);
    document.removeEventListener('ww:tags-updated', onTags);
  });

  it('buildUpdatedEntityTags merges tags and aliases from cleanTags/tags/теги', () => {
    expect(
      buildUpdatedEntityTags(
        { name: 'Алиса', cleanTags: ['гг'], attributes: { aliases: ['Аля'] } },
        'маг'
      )
    ).toMatchObject({
      nextTags: ['гг', 'маг'],
      nextAliases: ['Аля', 'маг']
    });

    expect(
      buildUpdatedEntityTags(
        { name: 'Боб', tags: ['воин'], attributes: { 'псевдонимы': ['Роб'] } },
        'рыцарь'
      )
    ).toMatchObject({
      nextTags: ['воин', 'рыцарь'],
      nextAliases: ['Роб', 'рыцарь']
    });

    expect(
      buildUpdatedEntityTags({ name: 'Варг', 'теги': ['враг'] }, 'босс')
    ).toMatchObject({
      nextTags: ['враг', 'босс'],
      nextAliases: ['босс']
    });
  });

  it('handleEntityTaggingOnSelect skips empty/exact matches and saves new tag otherwise', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Guards & exact matches
    handleEntityTaggingOnSelect({ id: 'e1', name: 'Алиса' }, '', 'proj-1');
    handleEntityTaggingOnSelect({ id: 'e1', name: 'Алиса' }, 'Алиса', '');
    handleEntityTaggingOnSelect({ id: 'e1', name: 'Алиса' }, 'алиса', 'proj-1');
    handleEntityTaggingOnSelect({ id: 'e1', name: 'Алиса', cleanTags: ['Маг'] }, 'маг', 'proj-1');
    handleEntityTaggingOnSelect({ id: 'e1', name: 'Алиса', aliases: ['Аля'] }, 'аля', 'proj-1');
    expect(mockSaveEntity).not.toHaveBeenCalled();

    // New tag triggers saveEntity + cache invalidation
    mockSaveEntity.mockResolvedValueOnce({});
    handleEntityTaggingOnSelect({ id: 'e1', name: 'Алиса', tags: ['герой'] }, 'прозвище', 'proj-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSaveEntity).toHaveBeenCalledTimes(1);
    expect(mockInvalidateCache).toHaveBeenCalledWith('entities:');

    // Rejected save logs warning without throwing
    mockSaveEntity.mockRejectedValueOnce(new Error('save fail'));
    handleEntityTaggingOnSelect({ id: 'e1', name: 'Алиса', 'теги': ['а'] }, 'новое', 'proj-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
