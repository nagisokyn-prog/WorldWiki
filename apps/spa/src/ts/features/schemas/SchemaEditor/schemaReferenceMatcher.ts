import type { SchemaFieldDef, SubContainerDef, RawTemplateDef } from './schemaReference.types';

export function isMatchTemplate(
  canonicalKey: string,
  container: { template?: string; type?: string; isBidirectional?: boolean; id?: string; title?: string },
  templateDef?: RawTemplateDef
): boolean {
  const isBidi = Boolean(container.isBidirectional || templateDef?.isBidirectional || templateDef?.bidirectionalLinkClass);
  const cType = String(container.type || templateDef?.type || 'dynamic').toLowerCase();
  const tplName = String(container.template || container.id || '').toLowerCase();
  const titleName = String(container.title || '').toLowerCase();

  if (canonicalKey === 'Двунаправленная связь') {
    return isBidi || tplName.includes('relationship') || tplName.includes('связь') || titleName.includes('связ') || titleName.includes('отношен');
  }
  if (canonicalKey === 'Базовая хронология') {
    return !isBidi && (cType === 'timeline' || tplName.includes('timeline') || tplName.includes('хронолог') || titleName.includes('хронолог') || titleName.includes('истори') || titleName.includes('событи'));
  }
  if (canonicalKey === 'Одиночный параметр') {
    return !isBidi && (canonicalKey === container.template || tplName.includes('параметр') || tplName.includes('parameter') || titleName.includes('параметр'));
  }
  if (canonicalKey === 'Динамический элемент') {
    return !isBidi && cType !== 'timeline' && !tplName.includes('timeline') && !titleName.includes('хронолог');
  }
  return false;
}

export function resolveContainerFields(
  dc: { fields?: SchemaFieldDef[]; template?: string; fieldOverrides?: Record<string, SchemaFieldDef> },
  schemaTemplates: Record<string, RawTemplateDef>,
  globalTemplates: Record<string, RawTemplateDef>,
  fallbackTemplateKey: string
): SchemaFieldDef[] {
  let tplDef: RawTemplateDef | undefined;
  if (dc.template) {
    tplDef = schemaTemplates[dc.template] || globalTemplates[dc.template];
  }
  if (!tplDef) {
    tplDef = globalTemplates[fallbackTemplateKey];
  }

  const baseFields: SchemaFieldDef[] = dc.fields || tplDef?.fields || [];
  const overrides: Record<string, SchemaFieldDef> = dc.fieldOverrides || {};

  const result: SchemaFieldDef[] = [];
  const handledClasses = new Set<string>();

  for (const f of baseFields) {
    const fKey = f.class || f.id || '';
    const ov = overrides[fKey] || {};
    handledClasses.add(fKey);

    const isProtected = ['начальная_глава', 'конечная_глава'].includes(fKey.replace(/__b$/, ''));
    if (ov.hidden && !isProtected) continue;

    result.push({
      ...f,
      ...ov,
      label: ov.label || f.label || fKey,
      placeholder: ov.placeholder !== undefined ? ov.placeholder : (f.placeholder || ''),
      type: isProtected ? (f.type || 'select') : (ov.type || f.type || 'text'),
      options: isProtected ? (f.options || []) : (ov.options || f.options || [])
    });
  }

  for (const fKey in overrides) {
    if (!handledClasses.has(fKey)) {
      const ov = overrides[fKey];
      if (ov && !ov.hidden) {
        result.push({
          class: fKey,
          id: fKey,
          label: ov.label || fKey,
          placeholder: ov.placeholder || '',
          type: ov.type || 'text',
          options: ov.options || []
        });
      }
    }
  }

  return result;
}

export function resolveSubContainers(
  subContainers: SubContainerDef[] | undefined,
  schemaTemplates: Record<string, RawTemplateDef>,
  globalTemplates: Record<string, RawTemplateDef>
): SubContainerDef[] {
  if (!Array.isArray(subContainers)) return [];
  return subContainers.map(sc => {
    let sTplDef: RawTemplateDef | undefined;
    if (sc.template) {
      sTplDef = schemaTemplates[sc.template] || globalTemplates[sc.template];
    }
    const sFields = sc.fields || sTplDef?.fields || [];
    return {
      ...sc,
      fields: sFields
    };
  });
}
