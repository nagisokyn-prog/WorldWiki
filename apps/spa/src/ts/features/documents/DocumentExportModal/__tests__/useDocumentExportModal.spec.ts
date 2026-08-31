import { describe, expect, it, vi } from 'vitest';
import { normalizeSemanticDocument } from '../../../../services/document/ast/ASTNormalizer';
import { DocumentExportService } from '../../../../services/document/export/DocumentExportService';
import { useDocumentExportModal } from '../useDocumentExportModal';

describe('useDocumentExportModal', () => {
  it('defaults to docx format and allows changing format', () => {
    const doc = normalizeSemanticDocument({ metadata: { title: 'Курсовая' } });
    const emit = vi.fn();
    const { selectedFormat } = useDocumentExportModal({ document: doc, isOpen: true }, emit);

    expect(selectedFormat.value).toBe('docx');
    selectedFormat.value = 'epub';
    expect(selectedFormat.value).toBe('epub');
  });

  it('handles export execution and shows success banner', async () => {
    const doc = normalizeSemanticDocument({ metadata: { title: 'Дипломная работа' } });
    const emit = vi.fn();

    vi.spyOn(DocumentExportService, 'export').mockResolvedValue({
      success: true,
      filePath: 'C:/Users/User/Downloads/Дипломная работа.docx',
      fileName: 'Дипломная работа.docx',
      fileSizeBytes: 10240
    });

    const { handleExport, successMessage, isExporting } = useDocumentExportModal(
      { document: doc, isOpen: true },
      emit
    );

    await handleExport();
    expect(isExporting.value).toBe(false);
    expect(successMessage.value).toContain('Дипломная работа.docx');
  });

  it('emits close event when closeModal is called', () => {
    const doc = normalizeSemanticDocument({});
    const emit = vi.fn();
    const { closeModal } = useDocumentExportModal({ document: doc, isOpen: true }, emit);

    closeModal();
    expect(emit).toHaveBeenCalledWith('close');
  });
});
