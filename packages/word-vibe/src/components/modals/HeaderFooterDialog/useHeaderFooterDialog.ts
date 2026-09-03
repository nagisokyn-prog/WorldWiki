import { ref, watch } from 'vue';

export interface HeaderFooterDialogProps {
  isOpen: boolean;
  initialTab?: 'header' | 'footer';
  header?: { left: string; center: string; right: string };
  footer?: { left: string; center: string; right: string };
}

export interface HeaderFooterPayload {
  header: { left: string; center: string; right: string };
  footer: { left: string; center: string; right: string };
}

export interface HeaderFooterEmit {
  (e: 'close'): void;
  (e: 'apply', payload: HeaderFooterPayload): void;
}

export function useHeaderFooterDialog(
  props: HeaderFooterDialogProps,
  emit: HeaderFooterEmit,
) {
  const activeTab = ref<'header' | 'footer'>(props.initialTab || 'header');
  const headerLeft = ref('');
  const headerCenter = ref('');
  const headerRight = ref('');
  const footerLeft = ref('');
  const footerCenter = ref('');
  const footerRight = ref('');

  watch(
    () => props.isOpen,
    (open) => {
      if (open) {
        activeTab.value = props.initialTab || 'header';
        headerLeft.value = props.header?.left || '';
        headerCenter.value = props.header?.center || '';
        headerRight.value = props.header?.right || '';
        footerLeft.value = props.footer?.left || '';
        footerCenter.value = props.footer?.center || '';
        footerRight.value = props.footer?.right || '';
      }
    },
  );

  const handleApply = () => {
    emit('apply', {
      header: { left: headerLeft.value, center: headerCenter.value, right: headerRight.value },
      footer: { left: footerLeft.value, center: footerCenter.value, right: footerRight.value },
    });
    emit('close');
  };

  return { activeTab, headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight, handleApply };
}
