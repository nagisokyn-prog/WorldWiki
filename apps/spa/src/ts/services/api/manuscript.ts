import { invoke } from '@tauri-apps/api/core';
import type { Chapter, ChapterHierarchy, EntityRel, SearchResult, TextBlock, Volume } from './types';

export async function getChapters(project: string): Promise<Chapter[]> {
  return await invoke('get_chapters', { project });
}

export async function getChapter(id: string): Promise<Chapter | null> {
  return await invoke('get_chapter', { id });
}

export async function createChapter(project: string, chapter: Chapter): Promise<Chapter> {
  return await invoke('create_chapter', { project, chapter });
}

export async function saveChapter(projectOrChapter: string | Chapter, maybeChapter?: Chapter): Promise<Chapter> {
  const chapter = maybeChapter ?? (projectOrChapter as Chapter);
  return await invoke('save_chapter', { chapter });
}

export async function deleteChapter(id: string): Promise<void> {
  return await invoke('delete_chapter', { id });
}

export async function getChapterHierarchy(project: string): Promise<ChapterHierarchy> {
  return await invoke('get_chapter_hierarchy', { project });
}

export async function createVolume(project: string, title: string): Promise<unknown> {
  return await invoke('create_volume', { project, title });
}

export async function updateVolume(project: string, id: string, title: string): Promise<void> {
  return await invoke('update_volume', { project, id, title });
}

export async function assignChapter(project: string, chapterId: string, volumeId: string | null): Promise<unknown> {
  return await invoke('assign_chapter', { project, chapterId, volumeId });
}

export async function reorderNode(project: string, nodeType: string, id: string, sortOrder: number): Promise<void> {
  return await invoke('reorder_node', { project, nodeType, id, sortOrder });
}

export async function autoExtendTimeline(project: string, chapterId: string, volumeId: string | null): Promise<unknown> {
  return await invoke('auto_extend_timeline', { project, chapterId, volumeId });
}

export async function healDeletedChapter(project: string, deletedChapterId: string, fallbackPoint: unknown | null): Promise<number> {
  return await invoke('heal_deleted_chapter', { project, deletedChapterId, fallbackPoint });
}

export async function getConnections(project: string, chapter: string | null): Promise<unknown> {
  return await invoke('get_connections', { project, chapter });
}

export async function saveConnections(project: string, sourceId: string, data: unknown): Promise<void> {
  return await invoke('save_connections', { project, sourceId, data });
}

export async function upsertConnectionsBatch(project: string, sourceType: string, sourceId: string, connections: EntityRel[]): Promise<void> {
  return await invoke('upsert_connections_batch', { project, sourceType, sourceId, connections });
}

export async function removeConnectionsBySource(project: string, eType: string, eId: string): Promise<number> {
  return await invoke('remove_connections_by_source', { project, eType, eId });
}

export async function getGlobalTimeline(project: string): Promise<unknown> {
  return await invoke('get_global_timeline', { project });
}

export async function saveGlobalTimeline(project: string, data: unknown): Promise<unknown> {
  return await invoke('save_global_timeline', { project, data });
}

export async function exportChapters(project: string, chapters: unknown[], format: string): Promise<string> {
  return await invoke('export_chapters', { project, chapters, format });
}

export async function exportDocumentDocx(request: unknown): Promise<unknown> {
  return await invoke('export_document_docx', { request });
}

export async function exportDocumentEpub(request: unknown): Promise<unknown> {
  return await invoke('export_document_epub', { request });
}

export async function exportDocumentFb2(request: unknown): Promise<unknown> {
  return await invoke('export_document_fb2', { request });
}

export async function exportDocumentPdfSave(fileName: string, pdfBytesBase64: string): Promise<unknown> {
  return await invoke('export_document_pdf_save', { fileName, pdfBytesBase64 });
}

export async function getChapterRevisions(project: string, chapterId: string): Promise<Record<string, unknown>[]> {
  return await invoke('get_chapter_revisions', { project, chapterId });
}

export async function saveTextBlocks(project: string, chapterId: string, html: string): Promise<void> {
  return await invoke('save_text_blocks', { project, chapterId, html });
}

export async function getVolumes(project: string): Promise<Volume[]> {
  return await invoke('get_volumes', { project });
}

export async function getVolume(id: string): Promise<Volume | null> {
  return await invoke('get_volume', { id });
}

export async function saveVolume(project: string, data: Volume): Promise<Volume> {
  return await invoke('save_volume', { project, data });
}

export async function deleteVolume(id: string): Promise<void> {
  return await invoke('delete_volume', { id });
}

export async function getTextBlocks(project: string): Promise<TextBlock[]> {
  return await invoke('get_text_blocks', { project });
}

export async function getTextBlock(id: string): Promise<TextBlock | null> {
  return await invoke('get_text_block', { id });
}

export async function saveTextBlock(project: string, data: TextBlock): Promise<TextBlock> {
  return await invoke('save_text_block', { project, data });
}

export async function deleteTextBlock(id: string): Promise<void> {
  return await invoke('delete_text_block', { id });
}

export async function searchTextBlocks(project: string, query: string): Promise<SearchResult<TextBlock>[]> {
  return await invoke('search_text_blocks', { project, query });
}
