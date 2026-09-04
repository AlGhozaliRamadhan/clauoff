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
  signal?: AbortSignal;
}

// Normalized model info returned by any backend
export interface NormalizedModel {
  id: string;
  label: string;
  backend: 'openai';
}

export interface NormalizedImageRequest {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  signal?: AbortSignal;
}

export interface NormalizedImageResult {
  bytes: Uint8Array;
  mimeType: SupportedImageMimeType;
  revisedPrompt?: string;
}

export type SupportedImageMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif'
  | 'image/avif';

// The backend adapter interface — everything goes through this
export interface ChatBackend {
  streamChat(request: NormalizedChatRequest): Promise<ReadableStream<string>>;
  listModels(): Promise<NormalizedModel[]>;
  generateImage(request: NormalizedImageRequest): Promise<NormalizedImageResult>;
}

// Backend type enum
export type BackendType = 'openai';
