/**
 * Model Variants & Architecture Support (ADR-0007 extension).
 *
 * Different local and API LLM families (Qwen, DeepSeek, Llama, Mistral, etc.)
 * have different tokenizers, chat templates, native reasoning mechanisms,
 * and tool-calling conventions.
 *
 * This module dynamically detects the model family and provides tailored
 * configurations without rigid hardcoding or forcing model personas.
 */

import type { ToolDefinition } from '@/lib/agent/tools';

export type ModelFamily = 'qwen' | 'deepseek' | 'llama' | 'mistral' | 'generic';

export interface ModelVariant {
  family: ModelFamily;
  displayName: string;
  /** Whether the model natively supports internal reasoning/thinking tokens */
  hasNativeThinking: boolean;
  /** Primary format for tool calls */
  toolFormat: 'qwen_xml' | 'qwen_json' | 'standard_xml' | 'generic';
  /** Default thought tag used by this model */
  thoughtTag: 'think' | 'thought' | 'thinking';
}

/**
 * Detect model variant from model ID string.
 * Uses smart heuristic matching on model name.
 */
export function detectModelVariant(modelId: string = ''): ModelVariant {
  const lower = modelId.toLowerCase();

  // DeepSeek family: deepseek-r1, deepseek-v3, deepseek-coder, distillations, etc.
  if (lower.includes('deepseek') || lower.includes('r1-distill') || lower.includes('deepseek_r1') || lower.includes('deepseek-r1')) {
    return {
      family: 'deepseek',
      displayName: 'DeepSeek',
      hasNativeThinking: true,
      toolFormat: 'standard_xml',
      thoughtTag: 'think',
    };
  }

  // Qwen family: qwen2, qwen2.5, qwq, qwen3, qwen-coder, etc.
  if (lower.includes('qwen') || lower.includes('qwq')) {
    return {
      family: 'qwen',
      displayName: 'Qwen',
      hasNativeThinking: true,
      toolFormat: 'qwen_xml',
      thoughtTag: 'think',
    };
  }

  // Llama family: llama-3, llama-3.1, llama-3.2, llama-3.3, etc.
  if (lower.includes('llama')) {
    return {
      family: 'llama',
      displayName: 'Llama',
      hasNativeThinking: false,
      toolFormat: 'standard_xml',
      thoughtTag: 'think',
    };
  }

  // Mistral family: mistral, codestral, mixtral, ministral, etc.
  if (lower.includes('mistral') || lower.includes('mixtral') || lower.includes('codestral')) {
    return {
      family: 'mistral',
      displayName: 'Mistral',
      hasNativeThinking: false,
      toolFormat: 'standard_xml',
      thoughtTag: 'think',
    };
  }

  // Generic / OpenAI-compatible default
  return {
    family: 'generic',
    displayName: 'Standard',
    hasNativeThinking: false,
    toolFormat: 'standard_xml',
    thoughtTag: 'think',
  };
}

/**
 * Map effort level to backend parameters for OpenAI/vLLM/Ollama/LM Studio endpoints.
 */
export function getReasoningRequestParams(
  modelId: string,
  effort: string = 'Medium',
  thinkingEnabled: boolean = true,
): Record<string, unknown> {
  const variant = detectModelVariant(modelId);

  // Map Cogito effort names to standard values
  let reasoning_effort: 'low' | 'medium' | 'high' = 'medium';
  if (effort === 'Low') reasoning_effort = 'low';
  if (effort === 'Medium') reasoning_effort = 'medium';
  if (['High', 'Extra', 'Max'].includes(effort)) reasoning_effort = 'high';

  const params: Record<string, unknown> = {};

  if (thinkingEnabled) {
    params.reasoning_effort = reasoning_effort;

    if (variant.family === 'qwen') {
      // Qwen chat template supports enable_thinking & reasoning_effort ('low' | 'medium' | 'xhigh')
      const qwenEffort = reasoning_effort === 'high' ? 'xhigh' : reasoning_effort;
      params.enable_thinking = true;
      params.chat_template_kwargs = {
        enable_thinking: true,
        reasoning_effort: qwenEffort,
      };
    } else if (variant.family === 'deepseek') {
      params.enable_thinking = true;
    }
  } else {
    if (variant.family === 'qwen') {
      params.enable_thinking = false;
      params.chat_template_kwargs = {
        enable_thinking: false,
      };
    }
  }

  return params;
}
