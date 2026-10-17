import { defineComponent, type PropType } from 'vue';
import { XboxWheel } from '@worldwiki/components';
import {
  useTimelinePanel,
  type TimelineEvent,
} from '@/features/timeline/Calendars/TimelinePanel/useTimelinePanel';

export type { TimelineEvent };

export default defineComponent({
  name: 'TimelinePanel',
  components: {
    XboxWheel,
  },
  props: {
    project: { type: String, required: true },
    events: { type: Array as PropType<TimelineEvent[]>, required: true }
  },
  emits: ['update:events', 'change'],
  setup(props, { emit }) {
    return useTimelinePanel(
      props,
      emit as unknown as (event: string, ...args: unknown[]) => void
    );
  }
});
