import type { AiProfile, AiProfileSettings } from '../../../types/ai.types'

export interface AiPrimaryModelCardProps {
  localSettings: AiProfileSettings;
    availableModelOptions: Array<{ value: string; label: string; description?: string }>;
    isFetchingModels?: boolean;
    fetchError?: string | null;
    activeProfile?: AiProfile | null;
}

export type AiPrimaryModelCardEmits = {
  (e: 'update-setting', key: keyof AiProfileSettings, val: unknown): void;
    (e: 'fetch-models', force: boolean): void;
};
