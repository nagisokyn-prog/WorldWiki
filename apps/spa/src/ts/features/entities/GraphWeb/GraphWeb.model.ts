export interface GraphWebNode {
  id: string;
  name: string;
  entity_type: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphWebEdge {
  id: string;
  source_id: string;
  target_id: string;
  rel_type: string;
  description?: string | null;
  strength?: number | null;
  is_auto_extend?: boolean;
  start_chapter?: string | null;
  start_order?: number | null;
  end_order?: number | null;
  start_m_abs?: number | null;
  end_m_abs?: number | null;
  inferred_start_m_abs?: number | null;
  needs_m_abs_warning?: boolean;
}

export interface GraphWebData {
  nodes: GraphWebNode[];
  edges: GraphWebEdge[];
}

export interface GraphWebFilterState {
  searchQuery: string;
  selectedChapterOrder: number | null;
  selectedMAbs: number | null;
  minStrength: number;
  showOnlyActive: boolean;
}
