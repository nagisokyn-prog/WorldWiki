import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { calendarApi } from '../../services/api/calendar.api';

export function useCalendars(project: string) {
  return useQuery({
    queryKey: ['calendars', project],
    queryFn: () => calendarApi.getCalendars(project),
    enabled: !!project
  });
}

export function useGlobalTimeline(project: string) {
  return useQuery({
    queryKey: ['globalTimeline', project],
    queryFn: () => calendarApi.getGlobalTimeline(project),
    enabled: !!project
  });
}

export function useSaveCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, data }: { project: string; data: any }) => 
      calendarApi.saveCalendar(project, data),
    onSuccess: (_, { project }) => {
      queryClient.invalidateQueries({ queryKey: ['calendars', project] });
    }
  });
}

export function useDeleteCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, id }: { project: string; id: string }) => 
      calendarApi.deleteCalendar(id),
    onSuccess: (_, { project }) => {
      queryClient.invalidateQueries({ queryKey: ['calendars', project] });
    }
  });
}

export function useSaveGlobalTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, data }: { project: string; data: unknown }) => 
      calendarApi.saveGlobalTimeline(project, data),
    onSuccess: (_, { project }) => {
      queryClient.invalidateQueries({ queryKey: ['globalTimeline', project] });
    }
  });
}
