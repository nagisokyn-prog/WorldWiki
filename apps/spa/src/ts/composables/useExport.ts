import * as api from '../services/api.client';

export interface ChapterExportData {
  id: string;
  title: string;
  content: string;
  [key: string]: unknown;
}

export interface ExportOptions {
  includeFootnotes?: boolean;
  includeTimeline?: boolean;
  [key: string]: unknown;
}

export function useExport() {
  async function exportChapters(projectName: string, chapters: ChapterExportData[], format: string, _options: ExportOptions = {}): Promise<string> {
    if (!chapters || chapters.length === 0) {
      throw new Error('Нет глав для экспорта');
    }

    try {
      const savedPath = await api.exportChapters(projectName, chapters, format) as { path?: string };
      console.log(`✅ Экспорт успешно завершен. Файл сохранен: ${savedPath.path}`);
      return savedPath.path || '';
    } catch (error) {
      console.error('❌ Ошибка генерации файла бэкендом:', error);
      throw error;
    }
  }

  return {
    exportChapters
  };
}
