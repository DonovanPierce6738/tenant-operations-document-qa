import { z } from "zod";
import { InfraiDocumentClient, type DocumentVector } from "./infrai_document_client.js";

export const AccountContextSchema = z.object({
  tenant_id: z.string().min(1),
  account_status: z.enum(["onboarding", "active", "suspended", "closed"]),
  actor_role: z.enum(["tenant_admin", "support_admin", "member"]),
});

export const QuestionRequestSchema = AccountContextSchema.extend({
  question: z.string().min(3).max(2_000),
});

export const IndexRequestSchema = AccountContextSchema.pick({ tenant_id: true }).extend({
  document_id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
});

export type AccountContext = z.infer<typeof AccountContextSchema>;
export type QuestionRequest = z.infer<typeof QuestionRequestSchema>;
export type IndexRequest = z.infer<typeof IndexRequestSchema>;

export function decideDocumentAccess(context: AccountContext): { allowed: boolean; reason: string } {
  if (context.account_status === "suspended" || context.account_status === "closed") {
    return { allowed: false, reason: "Account lifecycle state blocks document access" };
  }
  if (context.actor_role === "member") {
    return { allowed: false, reason: "Administrator role required for operational documents" };
  }
  return { allowed: true, reason: "Administrator access is active" };
}

export class TenantDocumentQa {
  private readonly client: InfraiDocumentClient;
  private readonly collection: string;

  constructor(
    client: InfraiDocumentClient,
    collection: string,
  ) {
    this.client = client;
    this.collection = collection;
  }

  async prepareCollection(): Promise<void> {
    const probe = await this.client.embed("tenant document index");
    await this.client.createCollection(this.collection, probe.length);
  }

  async indexDocument(input: IndexRequest): Promise<{ document_id: string; state: "indexed" }> {
    const embedding = await this.client.embed(`${input.title}\n${input.text}`);
    const vector: DocumentVector = {
      id: input.document_id,
      values: embedding,
      metadata: {
        tenant_id: input.tenant_id,
        title: input.title,
        text: input.text,
      },
    };
    await this.client.upsert(this.collection, [vector], `document-${input.tenant_id}-${input.document_id}`);
    return { document_id: input.document_id, state: "indexed" };
  }

  async answer(input: QuestionRequest): Promise<{
    decision: "answered" | "denied";
    reason: string;
    evidence?: unknown;
  }> {
    const access = decideDocumentAccess(input);
    if (!access.allowed) return { decision: "denied", reason: access.reason };

    const embedding = await this.client.embed(input.question);
    const matches = await this.client.query(this.collection, embedding, input.tenant_id, 8);
    const candidates = matches
      .map((match) => match.metadata?.text)
      .filter((text): text is string => typeof text === "string");
    if (candidates.length === 0) {
      return { decision: "answered", reason: "No matching tenant document was found", evidence: [] };
    }

    const evidence = await this.client.rerank(input.question, candidates, 3);
    return { decision: "answered", reason: "Tenant-scoped evidence reranked", evidence };
  }
}
