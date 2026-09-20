import { ref } from 'vue';

export interface ToolCallPayload {
  tool_call_id?: string;
  tool_name?: string;
  arguments?: unknown;
  tool_args?: unknown;
  [key: string]: unknown;
}

export interface AiToolApprovalProps {
  toolCall: ToolCallPayload;
}

export interface AiToolApprovalEmits {
  (e: 'approve', payload: { toolCallId: string; approved: boolean }): void;
  (e: 'reject', payload: { toolCallId: string; approved: boolean; feedback: string }): void;
}

export function useAiToolApproval(
  props: AiToolApprovalProps,
  emit: AiToolApprovalEmits
) {
  const feedbackText = ref('');
  const hasResponded = ref(false);
  const isApproved = ref(false);

  const formatArgs = (args: unknown) => {
    try {
      return JSON.stringify(args, null, 2);
    } catch {
      return String(args);
    }
  };

  const approveTool = () => {
    hasResponded.value = true;
    isApproved.value = true;
    emit('approve', { toolCallId: props.toolCall.tool_call_id || '', approved: true });
  };

  const rejectWithFeedback = () => {
    hasResponded.value = true;
    isApproved.value = false;
    emit('reject', { 
      toolCallId: props.toolCall.tool_call_id || '', 
      approved: false, 
      feedback: feedbackText.value 
    });
  };

  return {
    feedbackText,
    hasResponded,
    isApproved,
    formatArgs,
    approveTool,
    rejectWithFeedback
  };
}
