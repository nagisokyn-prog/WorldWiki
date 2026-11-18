import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { normalizeSemanticDocument } from '../../ast/ASTNormalizer';
import { DocumentExportService } from '../DocumentExportService';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('DocumentExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers window.print for PDF format', async () => {
    if (typeof window.print === 'undefined') {
      window.print = () => {};
    }
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const doc = normalizeSemanticDocument({
      metadata: { title: 'Отчет по НИР', authors: ['Исследователь'] }
    });

    const res = await DocumentExportService.export(doc, 'pdf');
    expect(printSpy).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.fileName).toBe('Отчет по НИР.pdf');

    printSpy.mockRestore();
  });

  it('exports docx, epub, fb2 via Tauri invoke and wraps errors', async () => {
    vi.mocked(invoke).mockResolvedValue({
      success: true,
      file_path: '/tmp/out.docx',
      file_name: 'out.docx',
      file_size_bytes: 1234,
    });

    const doc = normalizeSemanticDocument({
      metadata: { title: 'Книга', authors: ['Автор'] },
    });

    const docx = await DocumentExportService.export(doc, 'docx', 'Proj');
    expect(invoke).toHaveBeenCalledWith('export_document_docx', expect.any(Object));
    expect(docx.fileSizeBytes).toBe(1234);

    await DocumentExportService.export(doc, 'epub', 'Proj');
    expect(invoke).toHaveBeenCalledWith('export_document_epub', expect.any(Object));

    await DocumentExportService.export(doc, 'fb2', 'Proj');
    expect(invoke).toHaveBeenCalledWith('export_document_fb2', expect.any(Object));

    vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'));
    await expect(DocumentExportService.export(doc, 'docx', 'Proj')).rejects.toThrow(
      'Ошибка экспорта в DOCX: disk full'
    );
  });
});
