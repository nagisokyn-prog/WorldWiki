import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import * as api from '../../services/api.client';
import type { ProjectConfig } from '../../services/api/project.api';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects()
  });
}

export function useProjectConfig(name: string) {
  return useQuery({
    queryKey: ['projects', name, 'config'],
    queryFn: () => api.getProjectConfig(name) as unknown as Promise<ProjectConfig>,
    enabled: !!name
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.deleteProject(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['projects', name] });
    }
  });
}

export function useSaveProjectConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, config }: { name: string; config: ProjectConfig }) => 
      api.saveProjectConfig(name, config as unknown as Record<string, unknown>),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: ['projects', name, 'config'] });
    }
  });
}
