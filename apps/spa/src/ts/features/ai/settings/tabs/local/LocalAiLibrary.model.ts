import type { InstalledModelInfo, AiProfileSettings, ModelLifecycleState } from '@/features/ai/types/ai.types'

export interface LocalAiLibraryProps {
  installedModels: InstalledModelInfo[];
    localSettings: AiProfileSettings | null;
    getStateIcon: (state: ModelLifecycleState) => string;
    getStateLabel: (state: ModelLifecycleState) => string;
}

export type LocalAiLibraryEmits = {
  (e: 'switch-tab', tab: 'recommended'): void;
    (e: 'load', filename: string, kind?: string): void;
    (e: 'unload', filename: string): void;
    (e: 'delete', filename: string): void;
};
