/**
 * @file types.ts
 * @description Типы данных движка worldwiki-manuscript-wasm.
 * Полностью соответствуют Rust-структурам из worldwiki-manuscript-core.
 */

export interface ExtractedEntityMention {
  name: string;
  byte_start: number;
  byte_end: number;
  char_start: number;
  char_end: number;
}

export interface CrossReference {
  id: string;
  target_id: string;
  ref_type: string;
  display_label?: string;
}

export interface TargetMetadata {
  title: string;
  path?: string;
}

export interface ResolvedCrossReference {
  ref_id: string;
  target_id: string;
  is_resolved: boolean;
  target_title?: string;
  target_path?: string;
}

