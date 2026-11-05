import type { 
  AiProfileSettings, 
  InstalledModelInfo 
} from '@/features/ai/types/ai.types'

export interface AiRagConfigCardProps {
  localSettings: AiProfileSettings;
    installedModels?: InstalledModelInfo[];
    isCustomEmbedPath?: boolean;
    customEmbedInput?: string;
}

export type AiRagConfigCardEmits = {
  (e: 'update-setting', key: keyof AiProfileSettings, val: unknown): void;
    (e: 'custom-embed-input', val: string): void;
};
