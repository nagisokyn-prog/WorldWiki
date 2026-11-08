import type { EntityRevision } from '../EntityEditor/EntityEditor.model';

export interface EntityEditorWindowProps {
  project: string;
  entityType: string;
  entityId: string;
}

export interface EntityEditorWindowRevision extends EntityRevision {
  formattedDate?: string;
}

