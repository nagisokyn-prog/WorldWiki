import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentProcessor } from '../useDocumentProcessor';

describe('useDocumentProcessor', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes document processor state and toggles inspector/export modal', () => {
    const {
      isInspectorOpen,
      isExportModalOpen,
      openExportModal,
      closeExportModal,
      toggleInspector,
      semanticDoc
    } = useDocumentProcessor({});

    expect(isInspectorOpen.value).toBe(true);
    expect(isExportModalOpen.value).toBe(false);
    expect(semanticDoc.value.metadata.title).toBe('Курсовая работа');

    openExportModal();
    expect(isExportModalOpen.value).toBe(true);

    closeExportModal();
    expect(isExportModalOpen.value).toBe(false);

    toggleInspector();
    expect(isInspectorOpen.value).toBe(false);

    toggleInspector();
    expect(isInspectorOpen.value).toBe(true);
  });
});
