import { ref, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import type { PromiseCardMetaProps, PromiseCardMetaEmits, ProjectEntityOption, TimelineEventOption } from './PromiseCardMeta.model';

export function usePromiseCardMeta(
  props: PromiseCardMetaProps,
  emit: PromiseCardMetaEmits
) {
  const isEditingMeta = ref(false);
  const locationDraft = ref(props.item.location_id || '');
  const newParticipantDraft = ref('');
  const isAddingParticipant = ref(false);

  const projectLocations = ref<ProjectEntityOption[]>([]);
  const projectCharacters = ref<ProjectEntityOption[]>([]);
  const projectTimelineEvents = ref<TimelineEventOption[]>([]);

  const loadProjectEntities = async () => {
    if (!props.project) return;
    try {
      const [locs, places, chars, timelineData] = await Promise.all([
        api.getEntities(props.project, 'location').catch(() => []),
        api.getEntities(props.project, 'place').catch(() => []),
        api.getEntities(props.project, 'character').catch(() => []),
        api.getGlobalTimeline(props.project).catch(() => null)
      ]);

      const allLocs: ProjectEntityOption[] = [];
      const seenLocs = new Set<string>();

      const addLocList = (list: unknown[], type: string) => {
        if (Array.isArray(list)) {
          for (const item of list) {
            const ent = item as { id?: string; name?: string; title?: string };
            const id = ent.id || '';
            const name = ent.name || ent.title || id;
            if (id && !seenLocs.has(id)) {
              seenLocs.add(id);
              allLocs.push({ id, name, type });
            }
          }
        }
      };

      addLocList(locs, 'location');
      addLocList(places, 'place');
      projectLocations.value = allLocs;

      if (Array.isArray(chars)) {
        projectCharacters.value = chars.map((c: unknown) => {
          const char = c as { id?: string; name?: string; title?: string };
          return {
            id: char.id || '',
            name: char.name || char.title || char.id || '',
            type: 'character'
          };
        }).filter(c => Boolean(c.id));
      }

      if (timelineData && typeof timelineData === 'object') {
        const events = (timelineData as { events?: Array<{ id?: string; title?: string; name?: string; m_abs?: number }> }).events || [];
        if (Array.isArray(events)) {
          projectTimelineEvents.value = events.map(e => ({
            id: e.id || '',
            title: e.title || e.name || e.id || 'Событие',
            m_abs: e.m_abs
          })).filter(e => Boolean(e.id));
        }
      }
    } catch {
      // ignore
    }
  };

  watch(() => props.item.location_id, (val) => {
    locationDraft.value = val || '';
  });

  watch(() => props.project, loadProjectEntities);
  onMounted(loadProjectEntities);

  const saveLocation = () => {
    const val = locationDraft.value.trim();
    if (val === (props.item.location_id || '')) return;
    const updated = {
      ...props.item,
      location_id: val || null
    };
    emit('update:item', updated);
    emit('change');
  };

  const addParticipant = (nameOrId: string) => {
    const clean = nameOrId.trim();
    if (!clean) return;
    const current = [...(props.item.participant_ids || [])];
    if (!current.includes(clean)) {
      current.push(clean);
      const updated = {
        ...props.item,
        participant_ids: current
      };
      emit('update:item', updated);
      emit('change');
    }
    newParticipantDraft.value = '';
    isAddingParticipant.value = false;
  };

  const removeParticipant = (nameOrId: string) => {
    const current = (props.item.participant_ids || []).filter(p => p !== nameOrId);
    const updated = {
      ...props.item,
      participant_ids: current
    };
    emit('update:item', updated);
    emit('change');
  };

  const updateTimelineEvent = (eventId: string | null) => {
    const updated = {
      ...props.item,
      timeline_event_id: eventId || null
    };
    emit('update:item', updated);
    emit('change');
  };

  const updateKind = (newKind: string) => {
    if (newKind === props.item.kind) return;
    const updated = {
      ...props.item,
      kind: newKind
    };
    emit('update:item', updated);
    emit('change');
  };

  return {
    isEditingMeta,
    locationDraft,
    newParticipantDraft,
    isAddingParticipant,
    projectLocations,
    projectCharacters,
    projectTimelineEvents,
    saveLocation,
    addParticipant,
    removeParticipant,
    updateTimelineEvent,
    updateKind
  };
}
