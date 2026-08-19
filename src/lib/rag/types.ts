/** Project metadata (also mirrored in data/projects/registry.json) */
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  documentCount: number;
  /** Embedding model used for this project's vectors */
  embeddingModel?: string;
  /** Vector dimensionality; reject ingest if it changes mid-project */
  embeddingDims?: number;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  chunkCount: number;
  status: "pending" | "ready" | "error";
  errorMessage?: string;
  createdAt: number;
}

export interface ChunkRecord {
  id: string;
  documentId: string;
  projectId: string;
  chunkIndex: number;
  content: string;
  /** Hydrated from SQLite BLOB as number[] */
  embedding: number[];
  sourceFilename: string;
  locLabel?: string;
}

/** Returned to client via Cogito-Sources header / message.sources */
export interface SourceCitation {
  /** 1-based index matching [n] in the model answer */
  n: number;
  documentId: string;
  filename: string;
  /** Short preview of chunk text (≤160 chars) */
  snippet: string;
  score: number;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
  locLabel?: string;
}

export interface RetrieveOptions {
  projectId: string;
  query: string;
  /** Default 8 */
  topK?: number;
  /** Candidates per channel before RRF; default 20 */
  candidateK?: number;
}

export interface IngestResult {
  document: ProjectDocument;
  chunkCount: number;
}

export interface EmbeddingsClient {
  embedTexts(texts: string[]): Promise<number[][]>;
}
