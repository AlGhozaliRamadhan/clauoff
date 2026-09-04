# ADR-0018: OpenAI-Compatible Image Generation

## Status: Accepted

## Context

Cogito could chat with user-configured OpenAI-compatible backends, but it had no first-class path for image models commonly hosted in Colab, Kaggle, or a local GPU service. Calling those services directly from the browser would expose the active profile's API key, create cross-origin problems, and make remote image URLs part of permanent conversation state.

## Decision

- Extend the single `ChatBackend` abstraction and `OpenAiClient` implementation with image generation through `POST /images/generations`.
- Add an optional `imageModel` to each API profile, falling back to `IMAGE_MODEL`. The backend may select its own model when both are blank.
- Add an Image mode toggle to the composer. Image turns remain in the existing conversation tree, including edit, retry, branch switching, and local browser persistence.
- Proxy all generation through `POST /api/images/generations`; the browser never receives the backend URL or API key.
- Accept the standard `data[0].b64_json` or `data[0].url` response shapes and simple asynchronous `202` jobs polled at `/images/{id}`.
- Validate decoded content by file signature, cap generated files at 25 MB, and persist them under `DATA_DIR/generated-images` using opaque UUID filenames.
- Serve stored files from same-origin `GET /api/images/[id]`, with a download option. Never render or persist a provider URL in the browser.
- Permit same-origin backend image downloads. Cross-origin provider downloads require HTTPS, standard port 443, no embedded credentials, and DNS results that do not resolve to private or reserved addresses. Authentication is never forwarded cross-origin.

## Consequences

- Colab/Kaggle image servers work when their public tunnel exposes an OpenAI-compatible `/v1/images/generations` route.
- Existing chat profiles continue to load; `imageModel` is optional and migrated lazily.
- Generated images consume local disk space and are intentionally not deleted automatically because saved conversations reference them.
- Image history is local to the Cogito installation. Moving only browser storage to another installation does not move the image files.
- Model-specific options beyond prompt, model, size, and quality require a future compatibility extension.

## Implementation status

Completed on 2026-09-04:

- `src/lib/openai-client.ts`: image request, async job polling, base64/URL handling, and guarded remote downloads.
- `src/app/api/images/generations/route.ts`: validated generation boundary and local persistence.
- `src/app/api/images/[id]/route.ts`: same-origin display and download route.
- `src/lib/images/*`: image payload validation, storage, and client-safe metadata.
- `src/components/chat/*` and `src/components/layout/AppShell.tsx`: Image mode, rendering, cancellation, retry, edit, and branch persistence.
- `src/components/settings/SettingsModal.tsx`: optional per-profile image model.
- `test/lib/image-generation.test.ts` and `test/utils/tree-utils.test.ts`: protocol, storage, validation, and history coverage.
