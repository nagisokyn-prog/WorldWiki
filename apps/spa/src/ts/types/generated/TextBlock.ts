export type TextBlock = { id: string | null, project_id: string | null, chapter_id: string, block_type: string, order_index: bigint, content: string, embeddings: Record<string, unknown> | null, };
