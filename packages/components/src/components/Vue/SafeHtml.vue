<script lang="ts">
import { defineComponent, computed, h } from 'vue';
import DOMPurify from 'dompurify';

export default defineComponent({
  name: 'SafeHtml',
  props: {
    content: {
      type: String,
      default: ''
    },
    as: {
      type: String,
      default: 'div'
    }
  },
  setup(props) {
    const sanitizedHtml = computed(() => {
      if (!props.content) return '';
      return DOMPurify.sanitize(props.content, {
        USE_PROFILES: { html: true }
      });
    });

    return () => h(props.as, {
      class: 'safe-html',
      innerHTML: sanitizedHtml.value
    });
  }
});
</script>
