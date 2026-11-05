export interface TimeAtlasSnippetsTabProps {
  snippetFormats: Array<{ title: string; text: string }>;
    copiedIdx: number | null;
    copySnippet: (text: string, idx: number) => Promise<void>;
}

export type TimeAtlasSnippetsTabEmits = {};
