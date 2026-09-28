import { ref, computed, type Ref } from 'vue';
import type { PromiseCardMetaProps, PromiseCardMetaEmits, ProjectEntityOption } from './PromiseCardMeta.model';

export function usePromiseParticipants(
  props: PromiseCardMetaProps,
  projectCharacters: Ref<ProjectEntityOption[]>,
  emit: PromiseCardMetaEmits
) {
  const participantInputQuery = ref('');
  const isParticipantDropdownOpen = ref(false);

  const getParticipantDisplayName = (nameOrId: string): string => {
    if (!nameOrId) return '';
    const clean = String(nameOrId).trim();
    const cleanId = clean.replace(/^(characters|entities|character):/, '');
    const found = projectCharacters.value.find(c => {
      const cId = c.id.replace(/^(characters|entities|character):/, '');
      return cId === cleanId || c.name.toLowerCase() === clean.toLowerCase();
    });
    return found?.name || cleanId;
  };

  const currentParticipants = computed<string[]>(() => {
    const raw = props.item.participant_ids || [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of raw) {
      if (!p) continue;
      const key = getParticipantDisplayName(p).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
    return result;
  });

  const availableCharacters = computed<ProjectEntityOption[]>(() => {
    const selectedSet = new Set(
      currentParticipants.value.map(p => getParticipantDisplayName(p).toLowerCase())
    );
    const q = participantInputQuery.value.trim().toLowerCase();
    return projectCharacters.value.filter(char => {
      const charName = char.name.toLowerCase();
      const charCleanId = char.id.toLowerCase().replace(/^(characters|entities|character):/, '');
      const isSelected = selectedSet.has(charName) || selectedSet.has(charCleanId);
      if (isSelected) return false;
      return !q || charName.includes(q);
    });
  });

  const addParticipant = (nameOrId: string) => {
    const clean = nameOrId.trim();
    if (!clean) return;
    const current = [...(props.item.participant_ids || [])];
    const targetName = getParticipantDisplayName(clean).toLowerCase();
    const exists = current.some(
      p => getParticipantDisplayName(p).toLowerCase() === targetName
    );
    if (!exists) {
      const found = projectCharacters.value.find(c => {
        const cId = c.id.replace(/^(characters|entities|character):/, '');
        return cId === clean.replace(/^(characters|entities|character):/, '') || c.name.toLowerCase() === targetName || c.id === clean;
      });
      current.push(found ? found.id : clean);
      const updated = {
        ...props.item,
        participant_ids: current
      };
      emit('update:item', updated);
      emit('change');
    }
    participantInputQuery.value = '';
    isParticipantDropdownOpen.value = false;
  };

  const removeParticipant = (nameOrId: string) => {
    const targetName = getParticipantDisplayName(nameOrId).toLowerCase();
    const cleanTargetId = String(nameOrId).trim().toLowerCase();
    const current = (props.item.participant_ids || []).filter(
      (p: string) => getParticipantDisplayName(p).toLowerCase() !== targetName && p.toLowerCase() !== cleanTargetId
    );
    const updated = {
      ...props.item,
      participant_ids: current
    };
    emit('update:item', updated);
    emit('change');
  };

  const handleParticipantBackspace = () => {
    if (!participantInputQuery.value && currentParticipants.value.length > 0) {
      const last = currentParticipants.value[currentParticipants.value.length - 1];
      removeParticipant(last);
    }
  };

  return {
    participantInputQuery,
    isParticipantDropdownOpen,
    currentParticipants,
    availableCharacters,
    getParticipantDisplayName,
    addParticipant,
    removeParticipant,
    handleParticipantBackspace
  };
}
