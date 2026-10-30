import type { ProjectEntityOption } from './PromiseCardMeta.model'

export interface PromiseCardParticipantsProps {
  currentParticipants: string[];
    participantInputQuery: string;
    isParticipantDropdownOpen: boolean;
    availableCharacters: ProjectEntityOption[];
    getParticipantDisplayName: (idOrName: string) => string;
}

export type PromiseCardParticipantsEmits = {
  (e: 'update:participantInputQuery', val: string): void;
    (e: 'open-dropdown'): void;
    (e: 'close-dropdown'): void;
    (e: 'add-participant', name: string): void;
    (e: 'remove-participant', name: string): void;
    (e: 'backspace'): void;
};
