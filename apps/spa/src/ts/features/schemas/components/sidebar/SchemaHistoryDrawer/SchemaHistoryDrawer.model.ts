import type { SchemaHistoryRecord } from '@/features/schemas/composables/useSchemaHistory'

export interface SchemaHistoryDrawerProps {
  maxSaves: number;
    history: SchemaHistoryRecord[];
    previewId: string | null;
}

export type SchemaHistoryDrawerEmits = {
  (e: 'close'): void;
    (e: 'update:maxSaves', val: number): void;
    (e: 'preview', item: SchemaHistoryRecord): void;
    (e: 'toggle-pin', item: SchemaHistoryRecord): void;
};

export type SchemaHistoryItem = SchemaHistoryRecord;
