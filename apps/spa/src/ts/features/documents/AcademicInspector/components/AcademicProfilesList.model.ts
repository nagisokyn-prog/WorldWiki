import type { DocumentProfile } from '../../../../services/document/profiles/types'

export interface AcademicProfilesListProps {
  profiles: DocumentProfile[];
    activeProfileId: string;
}

export type AcademicProfilesListEmits = {
  (e: 'switch-profile', id: string): void;
};
