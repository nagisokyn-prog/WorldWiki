export type AgentMemory = { id: string | null, project_id: string | null, memory_type: string, content: string, embeddings: Record<string, unknown> | null, importance: bigint, };
