import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useChapterTreeSections, compareIds } from './useChapterTreeSections';

describe('useChapterTreeSections', () => {
  it('compares string, object, and empty IDs', () => {
    expect(compareIds(null, 'a')).toBe(false);
    expect(compareIds('chapters:1', '1')).toBe(true);
    expect(compareIds({ id: 'volumes:"v1"' }, 'v1')).toBe(true);
    expect(compareIds({ x: '1' }, { x: '2' })).toBe(false);
  });

  it('builds calendar, manuscript, and entity sections and supports node lookup helpers', () => {
    const hierarchy = ref({
      volumes: [{ id: 'volumes:v1', title: '' }],
      chapters: [
        { id: 'chapters:c1', title: 'Глава 1', volume_id: 'volumes:v1' },
        { id: 'chapters:c2', title: '', volume_id: null },
      ],
    } as any);
    const entitySections = ref([
      { type: 'character', title: 'Персонажи', emoji: '🧙' },
      { type: 'empty_type', title: 'Пусто', icon: 'fa-star' },
    ]);
    const entities = ref({
      character: [{ id: 'char:1', name: 'Герой' }],
    });
    const planets = ref([{ id: 'entity:planet:earth', name: '' }]);
    const calendars = ref([
      { id: 'cal:1', is_master: true, data: { название: 'Мастер' } },
      { id: 'cal:2', planet_id: 'entity:planet:earth', name: 'Местный' },
      { id: 'cal:3', planet_id: 'other_planet' },
    ]);

    const hook = useChapterTreeSections({
      hierarchy,
      entitySections,
      entities,
      getEntityName: (e) => String(e.name || e.id),
      entityKey: (t, id) => `${t}:${id}`,
      planets,
      calendars,
    });

    const sections = hook.explorerSections.value;
    expect(sections.map((s) => s.id)).toEqual(['calendars', 'manuscript', 'character', 'empty_type']);
    expect(sections[0].nodes[0].label).toBe('Планета');
    expect(sections[0].nodes[0].children).toHaveLength(2);
    expect(sections[0].nodes[0].children?.[0].label).toBe('Мастер (Master)');
    expect(sections[1].nodes[0].label).toBe('Без названия');
    expect(sections[1].nodes[1].label).toBe('Без названия');

    const chNode = hook.findNodeById('chapters:c1');
    expect(chNode).not.toBeNull();
    expect(hook.isNodeType(chNode!, 'chapter')).toBe(true);
    expect(hook.isEntityNode(chNode!)).toBe(false);

    const entNode = hook.findNodeById('character:char:1');
    expect(entNode).not.toBeNull();
    expect(hook.isEntityNode(entNode!)).toBe(true);

    expect(hook.findNodeById('non_existent')).toBeNull();
    expect(hook.getRootChapters()).toHaveLength(1);
  });
});
