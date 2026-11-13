export interface CloudSyncModalProps {}
export type CloudSyncModalEmits = {};

export interface MediaSyncProgress {
    current: number;
    total: number;
    current_file: string;
    active_files?: string[];
}

export type DatabaseSyncStatus = 'idle' | 'exporting' | 'uploading' | 'success' | 'error';
export type MediaSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface CloudSyncExportViewProps {
    yandexToken: string | null;
    isSyncing: boolean;
    dbSyncStatus: DatabaseSyncStatus;
    mediaSyncStatus: MediaSyncStatus;
    mediaProgress: MediaSyncProgress | null;
    lastBackupFileName: string;
}

export type CloudSyncExportViewEmits = {
    upload: [];
    exportLocal: [];
};
