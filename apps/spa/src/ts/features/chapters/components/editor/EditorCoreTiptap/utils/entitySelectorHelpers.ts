import type { EntitySelectorItem, EntityTypeItem } from '../EntityLinkSelector.model';

export function extractCleanTags(raw: unknown): string[] {
  if (!raw) return [];
  let items: unknown[] = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) items = parsed;
        else items = [trimmed];
      } catch {
        items = trimmed.split(',');
      }
    } else {
      items = trimmed.split(',');
    }
  }
  const result: string[] = [];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') {
      const clean = item.trim().replace(/^#/, '');
      if (clean) result.push(clean);
    } else if (typeof item === 'object') {
      const name = (item as { name?: string; title?: string; id?: string }).name ||
                   (item as { name?: string; title?: string; id?: string }).title ||
                   (item as { name?: string; title?: string; id?: string }).id;
      if (name && typeof name === 'string') {
        const clean = name.trim().replace(/^#/, '');
        if (clean) result.push(clean);
      }
    }
  }
  return Array.from(new Set(result));
}

export function extractAliases(raw: unknown, rawAttrs?: Record<string, unknown>): string[] {
  const sources = [
    raw,
    rawAttrs?.aliases,
    rawAttrs?.['псевдонимы'],
    rawAttrs?.['алиасы']
  ];
  const list: string[] = [];
  for (const s of sources) {
    if (!s) continue;
    if (Array.isArray(s)) {
      for (const item of s) {
        if (typeof item === 'string' && item.trim()) list.push(item.trim());
      }
    } else if (typeof s === 'string') {
      const parts = s.split(',');
      for (const p of parts) {
        if (p.trim()) list.push(p.trim());
      }
    }
  }
  return Array.from(new Set(list));
}

export function mapRawEntityToSelectorItem(
  r: EntitySelectorItem,
  schemaMap: Map<string, EntityTypeItem>
): EntitySelectorItem {
  let name = 'Без названия';
  if (r.name) name = String(r.name);
  else if ((r as { title?: string }).title) name = String((r as { title?: string }).title) || 'Без названия';
  else if ((r as { fio?: string }).fio) name = String((r as { fio?: string }).fio) || 'Без названия';

  const entityType = String(r.entity_type || (r as { type?: string }).type || 'unknown');
  const schema = schemaMap.get(entityType);

  const rawAttrs = (r as { attributes?: Record<string, unknown> }).attributes;
  const cleanTags = Array.from(new Set([
    ...extractCleanTags(r.tags),
    ...extractCleanTags((r as Record<string, unknown>)['теги']),
    ...extractCleanTags(rawAttrs?.tags),
    ...extractCleanTags(rawAttrs?.['теги']),
    ...extractCleanTags((r as { tag_names?: unknown }).tag_names)
  ]));

  const aliases = extractAliases((r as { aliases?: unknown }).aliases, rawAttrs);

  const entityId = String(r.id || '');
  const shortId = entityId.split(':').pop() || '';

  return {
    ...r,
    id: entityId,
    shortId,
    name,
    entity_type: entityType,
    type_name: schema?.name || entityType,
    type_icon: schema?.icon || '📌',
    tags: cleanTags,
    'теги': cleanTags,
    cleanTags,
    aliases
  };
}

