import type { SemanticDocument } from '../ast/types';
import type { ExportFormat } from '../profiles/types';

export interface ExportResult {
  success: boolean;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
}

export class DocumentExportService {
  /**
   * Exports a semantic document to the user's Downloads folder in DOCX, EPUB, FB2, or PDF.
   */
  public static async export(
    document: SemanticDocument,
    format: ExportFormat,
    projectName: string = 'WorldWiki'
  ): Promise<ExportResult> {
    const payload = {
      project_name: projectName,
      title: document.metadata.title || 'Документ',
      authors: document.metadata.authors || ['Автор'],
      profile_id: document.profileId,
      blocks: document.blocks
    };

    if (format === 'pdf') {
      // Direct browser-vector print dialogue for PDF
      window.print();
      return {
        success: true,
        filePath: 'Диалог печати PDF',
        fileName: `${payload.title}.pdf`,
        fileSizeBytes: 0
      };
    }

    try {
      // Dynamic import of Tauri invoke to remain unit-test safe in Vitest/Node
      const { invoke } = await import('@tauri-apps/api/core');

      let command = 'export_document_docx';
      if (format === 'epub') command = 'export_document_epub';
      if (format === 'fb2') command = 'export_document_fb2';

      const res = await invoke<{
        success: boolean;
        file_path: string;
        file_name: string;
        file_size_bytes: number;
      }>(command, { request: payload });

      return {
        success: res.success,
        filePath: res.file_path,
        fileName: res.file_name,
        fileSizeBytes: res.file_size_bytes
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Ошибка экспорта в ${format.toUpperCase()}: ${errorMsg}`);
    }
  }
}
