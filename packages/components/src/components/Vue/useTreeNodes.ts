import type { Directive } from 'vue';

export const vFocus: Directive<HTMLInputElement> = {
  mounted: (el: HTMLInputElement) => el.focus(),
};

export const useTreeNodes = () => {
  const isFaIcon = (val?: string): boolean => {
    if (!val) return false;
    return val.startsWith('fa-') || val.startsWith('fas ') || val.startsWith('far ') || val.startsWith('fab ') || val.includes(' fa-');
  };

  const formatFaIcon = (val?: string): string => {
    if (!val) return '';
    if (val.startsWith('fa-')) return `fas ${val}`;
    return val;
  };

  return {
    isFaIcon,
    formatFaIcon,
  };
};

