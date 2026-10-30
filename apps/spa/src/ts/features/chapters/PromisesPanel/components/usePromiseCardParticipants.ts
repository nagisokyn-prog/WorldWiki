import type { PromiseCardParticipantsEmits } from './PromiseCardParticipants.model';

export function usePromiseCardParticipants(emit: PromiseCardParticipantsEmits) {
  const handleRemove = (pid: string, event: Event) => {
    event.stopPropagation();
    console.log('[PromiseCardParticipants] Removing participant:', pid);
    emit('remove-participant', pid);
  };

  return {
    handleRemove
  };
}

