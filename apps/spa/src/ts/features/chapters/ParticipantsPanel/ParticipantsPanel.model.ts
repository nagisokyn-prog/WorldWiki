import type { ParticipantItem } from './useParticipantsPanel'

export interface ParticipantsPanelProps {
  project: string;
    participants?: (ParticipantItem | string)[] | null;
}

export type ParticipantsPanelEmits = {
  (e: 'update:participants', val: ParticipantItem[]): void;
    (e: 'change'): void;
};
