export interface AiMermaidDiagramProps {
  code: string;
}

export interface AiMermaidDiagramEmits {
  (e: 'rendered', svg: string): void;
}
