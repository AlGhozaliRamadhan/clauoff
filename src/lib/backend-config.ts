import { OpenAiClient } from '@/lib/openai-client';
import type { ChatBackend } from '@/lib/types';
import { getActiveBackendConfig } from '@/lib/api-profiles';

/**
 * Returns a fresh backend client built from the currently-active API profile.
 * No caching — changes via /api/config take effect on the very next request.
 */
export function getBackend(): ChatBackend {
  const cfg = getActiveBackendConfig();
  return new OpenAiClient(cfg.backendUrl, cfg.apiKey || undefined);
}

export function getDefaultModel(): string {
  const cfg = getActiveBackendConfig();
  return cfg.defaultModel || '';
}

export function getDefaultImageModel(): string {
  const cfg = getActiveBackendConfig();
  return cfg.imageModel || '';
}
