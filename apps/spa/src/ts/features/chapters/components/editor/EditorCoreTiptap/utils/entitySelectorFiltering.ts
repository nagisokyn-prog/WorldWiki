import type { EntitySelectorItem } from '../EntityLinkSelector.model';
import { computeSimilarity } from './entityMatch.utils';

export function computeCleanSearchQuery(query: string): string {
  return query.trim().replace(/^#/, '').replace(/^\(\(/, '').replace(/\)\)$/, '').trim();
}

export function filterMatchingEntities(
  allEntities: EntitySelectorItem[],
  searchQuery: string,
  cleanQ: string,
  activeTypeFilter: string
): EntitySelectorItem[] {
  let list = allEntities;
  if (activeTypeFilter !== 'all') {
    list = list.filter(e => e.entity_type === activeTypeFilter);
  }
  const q = searchQuery.trim().toLowerCase();
  if (!q) return list;

  const isTagSearch = q.startsWith('#');
  const cleanQLower = cleanQ.toLowerCase();

  return list.filter((e) => {
    const matchesTag = e.cleanTags?.some(t => {
      const lower = t.toLowerCase();
      return lower === cleanQLower || lower.includes(cleanQLower) || cleanQLower.includes(lower) || computeSimilarity(lower, cleanQLower) >= 0.5;
    });
    const matchesAlias = e.aliases?.some((a: string) => {
      const lower = a.toLowerCase();
      return lower === cleanQLower || lower.includes(cleanQLower) || cleanQLower.includes(lower) || computeSimilarity(lower, cleanQLower) >= 0.5;
    });
    if (isTagSearch) return matchesTag;

    const lowerName = e.name.toLowerCase();
    const matchesName = lowerName === cleanQLower || lowerName.includes(cleanQLower) || cleanQLower.includes(lowerName) || computeSimilarity(lowerName, cleanQLower) >= 0.5;
    const matchesId = e.id.toLowerCase().includes(cleanQLower) || (e.shortId && e.shortId.toLowerCase().includes(cleanQLower));
    const matchesType = e.type_name?.toLowerCase().includes(cleanQLower);
    return matchesName || matchesId || matchesType || matchesTag || matchesAlias;
  });
}

