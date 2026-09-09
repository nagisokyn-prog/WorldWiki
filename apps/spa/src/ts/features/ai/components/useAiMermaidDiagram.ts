import { ref, watch, onMounted } from 'vue';
import type { AiMermaidDiagramProps, AiMermaidDiagramEmits } from './AiMermaidDiagram.model';

interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  render(id: string, text: string): Promise<{ svg: string }>;
}

let mermaidInstance: MermaidApi | null = null;
let mermaidLoadingPromise: Promise<MermaidApi | null> | null = null;

async function getMermaidInstance(): Promise<MermaidApi | null> {
  if (mermaidInstance) return mermaidInstance;
  if (mermaidLoadingPromise) return mermaidLoadingPromise;

  mermaidLoadingPromise = (async () => {
    try {
      const win = window as unknown as { mermaid?: MermaidApi };
      if (win.mermaid) {
        mermaidInstance = win.mermaid;
        return mermaidInstance;
      }

      // Load local bundled mermaid module asynchronously
      const module = await import('mermaid');
      if (module && module.default) {
        mermaidInstance = (module.default as unknown) as MermaidApi;
        return mermaidInstance;
      }
      return null;
    } catch (e) {
      console.warn('Could not load Mermaid library:', e);
      return null;
    }
  })();

  return mermaidLoadingPromise;
}

export function useAiMermaidDiagram(
  props: AiMermaidDiagramProps,
  emit: AiMermaidDiagramEmits
) {
  const svgContent = ref('');
  const isLoading = ref(false);
  const errorMessage = ref('');
  const showRaw = ref(false);
  const isCopied = ref(false);

  let renderCounter = 0;

  const renderDiagram = async () => {
    const raw = props.code.trim();
    if (!raw) {
      svgContent.value = '';
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const mermaid = await getMermaidInstance();
      if (mermaid) {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'inherit'
        });

        const id = `mermaid_diag_${Date.now()}_${++renderCounter}`;
        const { svg } = await mermaid.render(id, raw);
        svgContent.value = svg;
        emit('rendered', svg);
      } else {
        // Fallback when offline or CDN unavailable: show nicely formatted source view
        showRaw.value = true;
      }
    } catch (e) {
      console.warn('Failed to render Mermaid diagram:', e);
      errorMessage.value = String(e);
      showRaw.value = true;
    } finally {
      isLoading.value = false;
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      isCopied.value = true;
      setTimeout(() => {
        isCopied.value = false;
      }, 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  const toggleRaw = () => {
    showRaw.value = !showRaw.value;
  };

  watch(() => props.code, renderDiagram);

  onMounted(() => {
    void renderDiagram();
  });

  return {
    svgContent,
    isLoading,
    errorMessage,
    showRaw,
    isCopied,
    copyCode,
    toggleRaw
  };
}
