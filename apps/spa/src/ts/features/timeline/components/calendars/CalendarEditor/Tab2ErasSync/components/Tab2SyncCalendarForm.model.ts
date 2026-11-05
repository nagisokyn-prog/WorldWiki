export interface Tab2SyncCalendarFormProps {
  targetCalendarId: string;
    targetCalendarYear: number;
    isReadOnly?: boolean;
}

export type Tab2SyncCalendarFormEmits = {
  (e: 'update-target-calendar', calId: string): void;
    (e: 'update-target-calendar-year', year: number): void;
};
