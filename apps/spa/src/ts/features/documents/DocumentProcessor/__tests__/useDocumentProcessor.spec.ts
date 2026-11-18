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

  it('creates Tiptap Editor on mount, syncs AST on update, and destroys on unmount', async () => {
    const { defineComponent } = await import('vue');
    const { mount } = await import('@vue/test-utils');

    let proc!: ReturnType<typeof useDocumentProcessor>;
    const Comp = defineComponent({
      setup() {
        proc = useDocumentProcessor({});
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    expect(proc.editor.value).not.toBeNull();
    expect(proc.numberingContext.value).toBeDefined();

    proc.editor.value?.commands.setContent('<p>Новый абзац</p>', { emitUpdate: true });
    expect(proc.semanticDoc.value.blocks.length).toBeGreaterThan(0);

    wrapper.unmount();
  });
});
