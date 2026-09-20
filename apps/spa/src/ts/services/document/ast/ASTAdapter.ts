import type { NumberingContext, NumberingProfile } from '../numbering/types';
import type { SemanticDocument } from './types';
import {
  tiptapToSemanticAST,
  type TiptapDocJson,
  type TiptapMarkJson,
  type TiptapNodeJson
} from './ast.tiptapToAST';
import { semanticASTToTiptap } from './ast.astToTiptap';

export type { TiptapDocJson, TiptapMarkJson, TiptapNodeJson };

/**
 * Bidirectional bridge between Tiptap JSON and WorldWiki Semantic AST.
 * Preserves node IDs, resolves computed labels, and handles marks.
 */
export class ASTAdapter {
  /**
   * Tiptap JSON ➔ Semantic AST
   */
  public static tiptapToSemanticAST(
    tiptapDoc: TiptapDocJson | TiptapNodeJson,
    existingDoc?: Partial<SemanticDocument>
  ): SemanticDocument {
    return tiptapToSemanticAST(tiptapDoc, existingDoc);
  }

  /**
   * Semantic AST ➔ Tiptap JSON
   */
  public static semanticASTToTiptap(
    doc: SemanticDocument,
    ctx?: NumberingContext,
    profile?: NumberingProfile
  ): TiptapDocJson {
    return semanticASTToTiptap(doc, ctx, profile);
  }
}
