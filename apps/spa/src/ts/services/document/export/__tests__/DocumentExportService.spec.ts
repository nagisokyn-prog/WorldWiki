import { describe, expect, it, vi } from 'vitest';
import { normalizeSemanticDocument } from '../../ast/ASTNormalizer';
import { DocumentExportService } from '../DocumentExportService';

describe('DocumentExportService', () => {
  it('triggers window.print for PDF format', async () => {
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
});
