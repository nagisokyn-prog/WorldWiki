import { ref, reactive, watch } from 'vue';

export interface ParagraphFormatData {
  alignment: 'left' | 'center' | 'right' | 'justify';
  firstLineType: 'none' | 'indent';
  firstLineCm: number;
  leftIndentCm: number;
  rightIndentCm: number;
  spaceBeforePt: number;
  spaceAfterPt: number;
  lineHeight: string;
}

export interface ParagraphFormatModalProps {
  isOpen: boolean;
  initialData?: Partial<ParagraphFormatData>;
}

export interface ParagraphFormatModalEmits {
  (e: 'close'): void;
  (e: 'apply', data: ParagraphFormatData): void;
}

export function useParagraphFormatModal(
  props: ParagraphFormatModalProps,
  emit: ParagraphFormatModalEmits
) {
  const activeTab = ref<'indents'>('indents');

  const form = reactive<ParagraphFormatData>({
    alignment: props.initialData?.alignment || 'justify',
    firstLineType: props.initialData?.firstLineType || 'indent',
    firstLineCm: props.initialData?.firstLineCm ?? 1.25,
    leftIndentCm: props.initialData?.leftIndentCm ?? 0.0,
    rightIndentCm: props.initialData?.rightIndentCm ?? 0.0,
    spaceBeforePt: props.initialData?.spaceBeforePt ?? 0,
    spaceAfterPt: props.initialData?.spaceAfterPt ?? 0,
    lineHeight: props.initialData?.lineHeight || '1.5'
  });

  watch(() => props.initialData, (newVal) => {
    if (newVal) {
      if (newVal.alignment) form.alignment = newVal.alignment;
      if (newVal.firstLineType) form.firstLineType = newVal.firstLineType;
      if (newVal.firstLineCm !== undefined) form.firstLineCm = newVal.firstLineCm;
      if (newVal.leftIndentCm !== undefined) form.leftIndentCm = newVal.leftIndentCm;
      if (newVal.rightIndentCm !== undefined) form.rightIndentCm = newVal.rightIndentCm;
      if (newVal.spaceBeforePt !== undefined) form.spaceBeforePt = newVal.spaceBeforePt;
      if (newVal.spaceAfterPt !== undefined) form.spaceAfterPt = newVal.spaceAfterPt;
      if (newVal.lineHeight) form.lineHeight = newVal.lineHeight;
    }
  }, { deep: true });

  const resetToGost = () => {
    form.alignment = 'justify';
    form.firstLineType = 'indent';
    form.firstLineCm = 1.25;
    form.leftIndentCm = 0.0;
    form.rightIndentCm = 0.0;
    form.spaceBeforePt = 0;
    form.spaceAfterPt = 0;
    form.lineHeight = '1.5';
  };

  const apply = () => {
    emit('apply', { ...form });
    emit('close');
  };

  return {
    activeTab,
    form,
    resetToGost,
    apply
  };
}
