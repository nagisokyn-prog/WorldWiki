import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { invoke } from '@tauri-apps/api/core';

describe('E2E Full-Stack: Жизненный цикл проекта «Не один» (DOM + Pinia + Rust + SurrealDB Mem)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('успешно создает проект с кириллицей и пробелом, том и главу в in-memory SurrealDB', async () => {
    const consoleErrors: string[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleErrors.push(args.map(a => String(a)).join(' '));
    });

    try {
      // 1. Создание проекта «Не один» (проверка кириллицы и пробелов в SurrealDB)
      const projectResult = await invoke('create_project', {
        name: 'Не один',
      });
      expect(projectResult).toBeDefined();

      // 2. Получение списка проектов
      const projects = (await invoke('get_projects')) as Array<{ id: string; name: string }>;
      expect(Array.isArray(projects)).toBe(true);
      const createdProject = projects.find(p => p.name === 'Не один');
      expect(createdProject).toBeDefined();
      const projectId = createdProject!.id;

      // 3. Создание тома
      const volumeResult = await invoke('create_volume', {
        projectId,
        title: 'Том 1: Начало пути',
      });
      expect(volumeResult).toBeDefined();

      // 4. Создание главы внутри тома с упоминанием ((Архимаг))
      const chapterResult = await invoke('create_chapter', {
        projectId,
        title: 'Глава 1: Пролог',
        content: '# Пролог\n\nВ старинную башню вошёл великий ((Архимаг)).',
      });
      expect(chapterResult).toBeDefined();

      // 5. Проверка иерархии глав
      const hierarchy = (await invoke('get_chapter_hierarchy', { projectId })) as unknown[];
      expect(hierarchy).toBeDefined();

      // 6. Проверка отсутствия критических ошибок SurrealDB схемы и приведения типов
      const criticalErrors = consoleErrors.filter(
        err =>
          err.includes('IPC ERROR') ||
          err.includes('Database error') ||
          err.includes('Expected record') ||
          err.includes('Constraint violation')
      );
      expect(criticalErrors).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
