import { ref } from 'vue';
import { DocumentExportService } from '../../../services/document/export/DocumentExportService';
import type { ExportFormat } from '../../../services/document/profiles/types';
import type { DocumentExportModalEmits, DocumentExportModalProps } from './DocumentExportModal.model';

export function useDocumentExportModal(
  props: DocumentExportModalProps,
  emit: DocumentExportModalEmits
) {
  const selectedFormat = ref<ExportFormat>('docx');
  const isExporting = ref(false);
  const errorMessage = ref<string | null>(null);
  const successMessage = ref<string | null>(null);

  async function handleExport() {
    isExporting.value = true;
    errorMessage.value = null;
    successMessage.value = null;

    try {
      const res = await DocumentExportService.export(
        props.document,
        selectedFormat.value,
        props.projectName || 'WorldWiki'
      );

      if (res.success) {
        successMessage.value = `Файл сохранен в Загрузки: ${res.fileName}`;
      }
    } catch (err: unknown) {
      errorMessage.value = err instanceof Error ? err.message : String(err);
    } finally {
      isExporting.value = false;
    }
  }

  function closeModal() {
    emit('close');
  }

  return {
    selectedFormat,
    isExporting,
    errorMessage,
    successMessage,
    handleExport,
    closeModal
  };
}
