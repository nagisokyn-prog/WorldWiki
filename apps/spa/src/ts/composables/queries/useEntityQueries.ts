import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { entityApi } from '../../services/Entity/entity.api';
import * as api from '../../services/api.client';
import type { EntityData, SchemaInfo, EntityType } from '../../services/Entity/entity.types';

export function useEntityList(project: string, type: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['entities', project, type, filters],
    queryFn: () => entityApi.getEntityList(project, type, filters),
    enabled: !!project && !!type
  });
}

export function useEntity(project: string, type: string, id: string) {
  return useQuery({
    queryKey: ['entities', project, type, id],
    queryFn: () => entityApi.getEntity(project, type, id),
    enabled: !!project && !!type && !!id
  });
}

export function useSchemas(project: string) {
  return useQuery({
    queryKey: ['schemas', project],
    queryFn: () => entityApi.getSchemas(project),
    enabled: !!project
  });
}

export function useEntityTypes(project: string) {
  return useQuery({
    queryKey: ['entityTypes', project],
    queryFn: () => api.getEntitySchemas(project),
    enabled: !!project
  });
}

export function useSaveEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, type, data, id, nameToSet }: 
      { project: string; type: string; data: Record<string, unknown>; id?: string; nameToSet?: string }) => 
      entityApi.saveEntity(project, type, data, id, nameToSet),
    onSuccess: (_, { project, type, id }) => {
      queryClient.invalidateQueries({ queryKey: ['entities', project, type] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['entities', project, type, id] });
      }
    }
  });
}

export function useDeleteEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, type, id }: { project: string; type: string; id: string }) => 
      entityApi.deleteEntity(project, type, id),
    onSuccess: (_, { project, type, id }) => {
      queryClient.invalidateQueries({ queryKey: ['entities', project, type] });
      queryClient.removeQueries({ queryKey: ['entities', project, type, id] });
    }
  });
}
