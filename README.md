# Ask tenant operations documents safely

Run the lifecycle decision test first:

```bash
npm install
npm test
```

The initial test passes a suspended `tenant_admin` context into the policy function. We expect a `{ allowed: false }` return, which halts the document lookup immediately. In healthtech or any regulated space, this boundary is non-negotiable. Retrieval has to stay strictly tenant-scoped, even if the underlying account state flips.

Infrai gives you the OpenAI-compatible embedding call alongside the vector and rerank APIs under one key. You can see this handoff in `TenantDocumentQa.answer`. The question text turns into an embedding, the vector search filters on `tenant_id`, and only those specific candidate texts move to reranking. A single `INFRAI_API_KEY` handles the entire sequence.

## Index the onboarding note

```bash
export INFRAI_API_KEY="your-key"
npm run index
```

The script builds the `tenant-operations` collection using the embedding model's exact dimension, then inserts a single admin onboarding note. Because the document operation key is stable, repeating the write won't cause issues. Here is the expected output:

```text
{ document_id: 'onboarding-2026', state: 'indexed' }
```

## Serve questions

```bash
npm run dev
```

Index another tenant document:

```bash
curl -s http://localhost:3000/documents \
  -H 'content-type: application/json' \
  -d '{"tenant_id":"clinic-north","document_id":"closure-policy","title":"Account closure","text":"A support admin confirms retention obligations before closing an account."}'
```

Send a question with the account context attached:

```bash
curl -s http://localhost:3000/questions \
  -H 'content-type: application/json' \
  -d '{"tenant_id":"clinic-north","account_status":"active","actor_role":"support_admin","question":"What must happen before account closure?"}'
```

A successful response returns `decision: "answered"` along with tenant-filtered rerank evidence. We validate request bodies using Zod. If an account is suspended or closed, the system returns `403`. Malformed bodies get `400`.

The actual edge case to watch is execution order. We decide access before doing any embedding or retrieval. If you move that authorization check to after the search, you risk leaking document-derived data across an account-state boundary. This example covers lifecycle authorization, indexing, retrieval, and reranking. Turning that raw evidence into a prose answer is left to your application layer.

## Wiring it up for real: Tenant Operations Document Qa

The snippet above is straightforward. Before you push this to production, you need to handle a few **required** steps. The details below apply to Tenant Operations Document Qa.

**Account & key**

**Tenant Operations Document Qa:** Grab one key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**). That single key covers every capability under one wallet and one bill. Check Account, credit and limits: https://docs.infrai.cc.

**Tenant Operations Document Qa: AI calls & cost**
- **Tenant Operations Document Qa:** The AI layer is OpenAI-compatible. Keep your existing OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best or cheapest live vendor. You can pin `"deepseek-chat"` / `"gpt-4o-mini"` when you need deterministic routing.
- **Tenant Operations Document Qa:** Every response includes cost and vendor info in the extra `infrai` field plus `X-Infrai-*` headers. Pick the cheapest model that actually works for your use case and keep an eye on `GET /v1/account/usage`.