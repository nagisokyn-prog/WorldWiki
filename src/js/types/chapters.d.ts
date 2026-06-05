/**
 * @file chapters.d.ts
 * @description Типы для глав
 * @rust-ready ✅ CRUD операции
 */

export {};

// Глава
export interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  parentId: string | null;  // null = корневая глава
  children: Chapter[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
  customFields: Record<string, unknown>;
}

// Результат экспорта глав
export interface ExportResult {
  success: boolean;
  path: string;
  error?: string;
}