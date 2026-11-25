import { ref, computed } from 'vue';
import { settingsService } from '@worldwiki/components';
import type { RelationshipBlockProps } from './RelationshipBlock.model';
import { useRelationshipFieldResolver } from './useRelationshipFieldResolver';
import { useRelationshipForeignSync } from './useRelationshipForeignSync';
import { useRelationshipNestedOps } from './useRelationshipNestedOps';

export function useRelationshipBlock(props: RelationshipBlockProps, emit: (event: string, ...args: unknown[]) => void) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');
  const localCollapsed = ref(false);
  const effectiveCollapsed = computed(() =>
    props.isCollapsed !== undefined ? props.isCollapsed : localCollapsed.value
  );
  const toggleCollapsed = () => {
    if (props.isCollapsed !== undefined) {
      emit('toggle-collapse');
    } else {
      localCollapsed.value = !localCollapsed.value;
    }
  };

  const nestedCollapsed = ref<Record<string, boolean>>({});
  const isNestedCollapsed = (key: string, idx: number): boolean =>
    Boolean(nestedCollapsed.value[`${key}_${idx}`]);
  const toggleNestedCollapse = (key: string, idx: number) => {
    const k = `${key}_${idx}`;
    const next = { ...nestedCollapsed.value };
    if (next[k]) delete next[k];
    else next[k] = true;
    nestedCollapsed.value = next;
  };
  const areAllNestedCollapsed = (key: string, count: number): boolean => {
    if (count <= 0) return false;
    for (let i = 0; i < count; i++) {
      if (!nestedCollapsed.value[`${key}_${i}`]) return false;
    }
    return true;
  };
  const toggleAllNestedCollapse = (key: string, count: number) => {
    const all = areAllNestedCollapsed(key, count);
    const next = { ...nestedCollapsed.value };
    for (let i = 0; i < count; i++) {
      const k = `${key}_${i}`;
      if (all) delete next[k];
      else next[k] = true;
    }
    nestedCollapsed.value = next;
  };

  const linkClass = computed<string>(() => {
    if (props.templateConf.bidirectionalLinkClass) {
      return props.templateConf.bidirectionalLinkClass;
    }
    const tpl = props.templateConf;
    if (tpl.fields) {
      const linkField = tpl.fields.find((f) => f.type === 'select' && f.entityType);
      if (linkField && linkField.class) return linkField.class;
      const anySelect = tpl.fields.find((f) => f.type === 'select');
      if (anySelect && anySelect.class) return anySelect.class;
      return tpl.fields[0]?.class || '';
    }
    return '';
  });

  const getTargetForeignId = () => {
    return linkClass.value ? props.item[linkClass.value] : undefined;
  };

  const { getResolvedFields, getDynamicContainerFields, getOptions } = useRelationshipFieldResolver(props);

  const {
    foreignItem,
    foreignLoading,
    foreignError,
    foreignModified,
    myLabel,
    foreignLabel,
    loadForeignItem,
    fetchForeignItem,
    updateForeignField,
    updateForeignNestedField
  } = useRelationshipForeignSync(props, emit, linkClass, getTargetForeignId);

  const {
    getNestedList,
    addNestedItem,
    removeNestedItem,
    updateItemField,
    onSelectChange,
    onLinkChange,
    makeSelectHandler,
    notifyNestedItemUpdate
  } = useRelationshipNestedOps(props, emit, linkClass, getResolvedFields, foreignItem, loadForeignItem);

  const formatLabel = (str: string) => {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  };

  const templateFields = computed(() => {
    return (props.templateConf?.fields || []).map((cf) => ({
      ...cf,
      displayLabel: cf.label || formatLabel(cf.class || '')
    }));
  });

  const getInputValue = (event: Event): string =>
    (event.target as HTMLInputElement | HTMLTextAreaElement).value;

  const getInputNumber = (event: Event): number =>
    Number((event.target as HTMLInputElement).value);

  const relationshipSummary = computed(() => {
    const typeField = templateFields.value.find((f) => f.class !== linkClass.value && f.type === 'select');
    const typeVal = typeField ? String(props.item[typeField.class] || '').trim() : '';
    const target = foreignLabel.value;
    if (target && target !== 'Взаимное отношение' && typeVal) return `${target} (${typeVal})`;
    if (target && target !== 'Взаимное отношение') return target;
    return typeVal || '';
  });

  const getNestedSummary = (nItem: Record<string, unknown>): string => {
    const val = nItem['тип_связи'] || nItem['статус_категория'] || nItem['название'] || nItem['описание_причина'];
    return val ? String(val).trim() : '';
  };

  return {
    wheelHorizontal,
    effectiveCollapsed,
    toggleCollapsed,
    relationshipSummary,
    nestedCollapsed,
    isNestedCollapsed,
    toggleNestedCollapse,
    areAllNestedCollapsed,
    toggleAllNestedCollapse,
    getNestedSummary,
    templateFields,
    formatLabel,
    getInputValue,
    getInputNumber,
    foreignItem,
    foreignLoading,
    foreignError,
    foreignModified,
    linkClass,
    myLabel,
    foreignLabel,
    fetchForeignItem,
    onLinkChange,
    loadForeignItem,
    getOptions,
    getResolvedFields,
    getNestedList,
    addNestedItem,
    removeNestedItem,
    getDynamicContainerFields,
    updateItemField,
    updateForeignField,
    updateForeignNestedField,
    onSelectChange,
    makeSelectHandler,
    notifyNestedItemUpdate
  };
}
