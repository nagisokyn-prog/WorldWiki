import type {
  WordDocumentDTO,
  WordBlockDTO,
  WordDocumentMetadataDTO,
} from '../types/dto';
import type { V2NodeJson } from './ASTToV2Converter';
import { convertMarksFromV2 } from './v2Marks';
import { convertInlineFromV2, generateId } from './v2Inlines';
import { convertBlockFromV2 } from './v2Blocks';

export { convertMarksFromV2, convertInlineFromV2, convertBlockFromV2 };

/**
 * Преобразует Tiptap v2 Document JSON обратно в Semantic AST (WordDocumentDTO).
 */
export function v2DocToSemanticAST(
  doc: V2NodeJson,
  metadata?: WordDocumentMetadataDTO,
  profileId?: string,
  documentId?: string,
): WordDocumentDTO {
  const blocks: WordBlockDTO[] = [];

  if (doc.content && Array.isArray(doc.content)) {
    for (const node of doc.content) {
      blocks.push(convertBlockFromV2(node));
    }
  }

  return {
    id: documentId || generateId(),
    metadata: metadata || {
      title: 'Документ',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    profileId: profileId || 'default',
    blocks,
  };
}
