import { defineComponent, type PropType } from 'vue';
import { XboxWheel } from '@worldwiki/components';
import { UniversalDatePicker } from '@/shared/ui';
import {
  useLegacyTimelinePanel,
  type TimelineEvent,
  type UseLegacyTimelineProps,
  type UseLegacyTimelineEmits
} from './useLegacyTimelinePanel';

export type { TimelineEvent };

export default defineComponent({
  name: 'TimelinePanel',
  components: {
    XboxWheel,
    UniversalDatePicker
  },
  props: {
    project: { type: String, required: true },
    events: { type: Array as PropType<TimelineEvent[]>, required: true }
  },
  emits: ['update:events', 'change'],
  setup(props, { emit }) {
    return useLegacyTimelinePanel(
      props as UseLegacyTimelineProps,
      emit as unknown as UseLegacyTimelineEmits
    );
  }
});
