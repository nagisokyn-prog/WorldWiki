import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { useChapterStore } from '@/stores/chapter.store';

describe('E2E Full-Stack: Дерево Рукописи (Тома, Главы и вложенность узлов в SurrealDB)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('создает том и главу ВНУТРИ дерева тома с проверкой рёбер contains и реактивного стора', async () => {
    // 1. Создаем проект «Хроники Этернии»
    const projectName = 'Хроники Этернии';
    await invoke('create_project', { name: projectName });

    const projects = (await invoke('get_projects')) as Array<{ id: string; name: string }>;
    const project = projects.find(p => p.name === projectName);
    expect(project).toBeDefined();
    const projectId = project!.name;

    // 2. Создаем том «Том 1: Обитель Ветров»
    const volumeTitle = 'Том 1: Обитель Ветров';
    const rawVolume = (await invoke('create_volume', {
      project: projectId,
      title: volumeTitle,
    })) as { id: string; title: string };
    expect(rawVolume).toBeDefined();
    expect(rawVolume.id).toBeDefined();
    const volumeId = rawVolume.id;

    // 3. Подключаем Pinia-стор управления главами (реальный слой фронтенда)
    const chapterStore = useChapterStore();

    // Загружаем начальное состояние иерархии
    await chapterStore.loadChapters(projectId);
    expect(chapterStore.hierarchy.volumes.length).toBe(1);
    expect(chapterStore.hierarchy.volumes[0].title).toBe(volumeTitle);
    expect(chapterStore.hierarchy.chapters.length).toBe(0);

    // 4. Создаем главу ВНУТРИ тома через метод стора (как это делает UI ChapterTree)
    const newChapter = await chapterStore.createNewChapter(projectId, volumeId);
    expect(newChapter).toBeDefined();
    expect(newChapter.id).toBeDefined();
    expect(newChapter.volume_id).toBe(volumeId);

    // 5. Проверяем состояние БД через get_chapter_hierarchy
    const hierarchy = (await invoke('get_chapter_hierarchy', { project: projectId })) as {
      volumes: Array<{ id: string; title: string }>;
      chapters: Array<{ id: string; title: string; volume_id?: string }>;
      relations: Array<{ in: string; out: string; sort_order: number }>;
    };

    expect(hierarchy.volumes.length).toBe(1);
    expect(hierarchy.chapters.length).toBe(1);

    const chapterInDb = hierarchy.chapters[0];
    expect(chapterInDb.volume_id).toBe(volumeId);

    // 6. Проверяем реактивный стор фронтенда:
    // Текущий том и глава должны быть согласованы
    expect(chapterStore.currentChapterId).toBe(chapterInDb.id);
    expect(chapterStore.currentVolume?.id).toBe(volumeId);

    // 7. Проверяем перепривязку главы в корень проекта (вытаскивание из тома)
    await invoke('assign_chapter', {
      project: projectId,
      chapterId: chapterInDb.id,
      volumeId: null,
    });

    await chapterStore.loadChapters(projectId);

    // Теперь в базе глава отвязана от тома:
    const rootHierarchy = (await invoke('get_chapter_hierarchy', { project: projectId })) as {
      volumes: Array<{ id: string; title: string }>;
      chapters: Array<{ id: string; title: string; volume_id?: string }>;
    };

    const unassignedChap = rootHierarchy.chapters.find(c => c.id === chapterInDb.id);
    expect(unassignedChap).toBeDefined();
    expect(unassignedChap!.volume_id).toBeUndefined();

    // 8. Возвращаем главу обратно в том через assign_chapter
    await invoke('assign_chapter', {
      project: projectId,
      chapterId: chapterInDb.id,
      volumeId: volumeId,
    });

    await chapterStore.loadChapters(projectId);
    const restoredChapter = chapterStore.hierarchy.chapters.find(c => c.id === chapterInDb.id);
    expect(restoredChapter?.volume_id).toBe(volumeId);
  });
});
