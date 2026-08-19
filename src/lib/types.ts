// Normalized message role type
export type MessageRole = 'user' | 'assistant' | 'system';

// A single message in a chat conversation
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// Normalized chat request sent to any backend
export interface NormalizedChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  reasoning_effort?: 'low' | 'medium' | 'high';
  max_tokens?: number;
  /** Penalize token repetition to avoid degeneration loops (OpenAI-compatible) */
  frequency_penalty?: number;
  /**
   * Some OpenAI-compatible backends (e.g. llama.cpp / cogito.py) only honor
   * `repeat_penalty` and silently drop `frequency_penalty`. Send both so
   * either implementation applies the penalty.
   */
  repeat_penalty?: number;
}

// Normalized model info returned by any backend
export interface NormalizedModel {
  id: string;
  label: string;
  backend: 'openai';
}

// The backend adapter interface — everything goes through this
export interface ChatBackend {
  streamChat(request: NormalizedChatRequest): Promise<ReadableStream<string>>;
  listModels(): Promise<NormalizedModel[]>;
}

// Backend type enum
export type BackendType = 'openai';
