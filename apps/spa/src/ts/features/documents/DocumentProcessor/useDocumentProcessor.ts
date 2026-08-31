import { Editor } from '@tiptap/vue-3';
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { ASTAdapter, type TiptapDocJson } from '../../../services/document/ast/ASTAdapter';
import { normalizeSemanticDocument } from '../../../services/document/ast/ASTNormalizer';
import type { SemanticDocument } from '../../../services/document/ast/types';
import { LayoutEngineService } from '../../../services/document/layout/LayoutEngineService';
import { NumberingEngine } from '../../../services/document/numbering/NumberingEngine';
import type { NumberingContext } from '../../../services/document/numbering/types';
import { useDocumentProfilesStore } from '../../../stores/document_profiles.store';
import { createDocumentEditorExtensions } from '../extensions';
import type { DocumentProcessorProps } from './DocumentProcessor.model';

export function useDocumentProcessor(props: DocumentProcessorProps) {
  const editor = shallowRef<Editor | null>(null);
  const profilesStore = useDocumentProfilesStore();

  const semanticDoc = ref<SemanticDocument>(
    props.initialDocument ||
      normalizeSemanticDocument({
        metadata: {
          title: 'Курсовая работа',
          authors: ['Студент'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      })
  );

  const isExportModalOpen = ref(false);
  const isInspectorOpen = ref(true);

  const numberingContext = computed<NumberingContext>(() => {
    return NumberingEngine.compute(semanticDoc.value, profilesStore.activeProfile.numbering);
  });

  function openExportModal() {
    isExportModalOpen.value = true;
  }

  function closeExportModal() {
    isExportModalOpen.value = false;
  }

  function toggleInspector() {
    isInspectorOpen.value = !isInspectorOpen.value;
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      const layoutConfig = LayoutEngineService.buildPaginationConfig({
        page: profilesStore.activeProfile.page,
        headersFooters: profilesStore.activeProfile.headersFooters,
        documentTitle: semanticDoc.value.metadata.title
      });

      const initialContent = ASTAdapter.semanticASTToTiptap(
        semanticDoc.value,
        numberingContext.value,
        profilesStore.activeProfile.numbering
      );

      editor.value = new Editor({
        extensions: createDocumentEditorExtensions({
          defaultAlignment: profilesStore.activeProfile.paragraph.alignment === 'justify' ? 'justify' : 'left',
          defaultLineHeight: String(profilesStore.activeProfile.paragraph.lineHeight),
          defaultFirstLineIndent: `${profilesStore.activeProfile.paragraph.firstLineIndentMm}mm`,
          pagination: layoutConfig
        }),
        content: initialContent as unknown as Record<string, unknown>,
        onUpdate: ({ editor: ed }) => {
          const json = ed.getJSON() as unknown as TiptapDocJson;
          semanticDoc.value = ASTAdapter.tiptapToSemanticAST(json, semanticDoc.value);
        }
      });
    });

    onBeforeUnmount(() => {
      editor.value?.destroy();
    });
  }

  return {
    editor,
    semanticDoc,
    numberingContext,
    isExportModalOpen,
    isInspectorOpen,
    openExportModal,
    closeExportModal,
    toggleInspector
  };
}
