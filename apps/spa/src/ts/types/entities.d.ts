/**
 * @file entities.d.ts
 * @description Типы для сущностей
 * @rust-ready ✅ CRUD операции
 */

export {};

// Базовая сущность — всё остальное в customFields
export interface BaseEntity {
  id: string;
  name: string;
  type: string;           // любой тип, без хардкода
  description: string;
  icon: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  connections: Connection[];
  customFields: Record<string, unknown>;  // сюда всё остальное
}

// Связь
export interface Connection {
  targetId: string;
  type: string;
  description: string;
  strength: number;
}