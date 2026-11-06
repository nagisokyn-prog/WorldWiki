import type { SchemaField } from '../../EntityEditor.model';

export interface EntitySectionFieldsProps {
  fields: SchemaField[];
  project: string;
  wheelHorizontal?: boolean;
  photoInputs: Record<string, HTMLInputElement>;
  isFieldHidden: (key: string) => boolean;
  canHideField: (field: SchemaField) => boolean;
  isFieldChanged: (key: string) => boolean;
  getProp: (path: string) => unknown;
  setProp: (path: string, val: unknown) => void;
  getPhotoUrl: (path: string) => string;
  triggerPhotoUpload: (path: string) => void;
  handlePhotoFile: (e: Event, path: string) => void;
  handlePhotoDrop: (e: DragEvent, path: string) => void;
  removePhoto: (path: string) => void;
  isChapterField: (field: SchemaField) => boolean;
  getOptionsFor: (field: SchemaField) => Array<{ value: string; label: string }>;
}

export type EntitySectionFieldsEmits = {
  (e: 'hideField', path: string): void;
  (e: 'modified'): void;
};

