import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { batchApi } from '../../services/api/batch.api';

export function useSaveEntityWithRelations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, entity, relations }: { project: string; entity: Record<string, unknown>; relations: Record<string, unknown>[] }) => 
      batchApi.saveEntityWithRelations(project, entity, relations),
    onSuccess: (_, { project }) => {
      // Invalidate everything related to entities and connections
      queryClient.invalidateQueries({ queryKey: ['entities', project] });
      queryClient.invalidateQueries({ queryKey: ['connections', project] });
    }
  });
}

export function useUpsertConnectionsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, connections }: { project: string; connections: Record<string, unknown>[] }) => 
      batchApi.upsertConnectionsBatch(project, 'Unknown', 'Unknown', connections),
    onSuccess: (_, { project }) => {
      queryClient.invalidateQueries({ queryKey: ['connections', project] });
    }
  });
}
