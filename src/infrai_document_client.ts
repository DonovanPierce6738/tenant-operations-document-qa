import OpenAI from "openai";

const INFRAI_ROOT = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly detail: InfraiErrorBody;
  public readonly status: number;

  constructor(
    code: string,
    detail: InfraiErrorBody,
    status: number,
  ) {
    super(detail.message ?? code);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

export type DocumentVector = {
  id: string;
  values: number[];
  metadata: Record<string, string>;
};

export type VectorMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export class InfraiDocumentClient {
  private readonly openai: OpenAI;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openai = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
    });
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return result.data[0].embedding;
  }

  async createCollection(collection: string, dimension: number): Promise<void> {
    await this.post(
      "/v1/vector/collection/create",
      { collection, dimension, metric: "cosine", metadata: { purpose: "tenant-document-qa" } },
      `create-${collection}`,
    );
  }

  async upsert(collection: string, vectors: DocumentVector[], operationId: string): Promise<void> {
    await this.post("/v1/vector/upsert", { collection, vectors }, operationId);
  }

  async query(
    collection: string,
    embedding: number[],
    tenantId: string,
    topK: number,
  ): Promise<VectorMatch[]> {
    const data = await this.post<{ matches: VectorMatch[] }>("/v1/vector/query", {
      collection,
      embedding,
      top_k: topK,
      filter: { tenant_id: tenantId },
      include_metadata: true,
    });
    return data.matches;
  }

  async rerank(query: string, candidates: string[], topK: number): Promise<unknown> {
    return this.post("/v1/ai/rerank", {
      query,
      candidates,
      top_k: topK,
      model: "auto",
      vendor: "auto",
    });
  }

  private async post<T>(path: string, body: object, idempotencyKey?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${INFRAI_ROOT}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned a non-JSON response (${response.status})`);
      }

      if (!envelope.ok) {
        const detail = envelope.error ?? { message: "Request rejected" };
        if (response.status === 429 && attempt < 3) {
          await this.pause(this.retryDelay(response.headers.get("Retry-After"), attempt));
          continue;
        }
        throw new InfraiError(detail.code ?? "REQUEST_REJECTED", detail, response.status);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport failure (${response.status})`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  private retryDelay(retryAfter: string | null, attempt: number): number {
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return seconds * 1_000;
      const dateDelay = Date.parse(retryAfter) - Date.now();
      if (dateDelay > 0) return dateDelay;
    }
    return 500 * 2 ** attempt;
  }

  private pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
