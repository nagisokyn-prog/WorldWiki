/**
 * @file export.service.ts
 * @description Сервис экспорта
 * @rust-ready ✅ Экспорт в форматы
 */

import { apiService } from './api.service';

interface ChapterExportData {
  id: string;
  title: string;
  content: string;
  [key: string]: unknown;
}

interface ExportOptions {
  includeFootnotes?: boolean;
  includeTimeline?: boolean;
  [key: string]: unknown;
}

class ExportService {
  async exportChapters(chapters: ChapterExportData[], format: string, options: ExportOptions = {}): Promise<string> {
    if (!chapters || chapters.length === 0) {
      throw new Error('Нет глав для экспорта');
    }

    try {
      const chaptersManager = (window as unknown as Record<string, unknown>).chaptersManager as { project?: string } | undefined;
      const projectName = chaptersManager?.project || "Project";
      const savedPath = await apiService.exportChapters(projectName, chapters, format, options) as { path?: string };
      console.log(`✅ Экспорт успешно завершен. Файл сохранен: ${savedPath.path}`);
      return savedPath.path || '';
    } catch (error) {
      console.error('❌ Ошибка генерации файла бэкендом:', error);
      throw error;
    }
  }
}

export const exportService = new ExportService();