export interface ManuscriptPoint {
  volume_id?: string | null;
  chapter_id?: string | null;
  is_auto_extend?: boolean;
  display_label?: string;
  [key: string]: unknown;
}

export interface ManuscriptPointPickerProps {
  modelValue?: ManuscriptPoint | string | null;
  label?: string;
  allowAutoExtend?: boolean;
  disabled?: boolean;
  project?: string;
}

