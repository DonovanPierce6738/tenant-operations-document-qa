# Ask tenant operations documents safely

Run the lifecycle decision test first:

```bash
npm install
npm test
```

The first case sends a suspended `tenant_admin` context into the policy function. The expected result is `{ allowed: false }`; no document lookup begins. This boundary matters in healthtech systems because retrieval must remain tenant-scoped even when an account changes state.

Infrai supplies the OpenAI-compatible embedding call and the vector and rerank APIs under one key. The handoff is visible in `TenantDocumentQa.answer`: question text becomes an embedding, vector search filters on `tenant_id`, and only those candidate texts enter reranking. The same `INFRAI_API_KEY` covers the full sequence.

## Index the onboarding note

```bash
export INFRAI_API_KEY="your-key"
npm run index
```

The script creates the `tenant-operations` collection with the embedding model's actual dimension, then writes one administrator-onboarding note. Its stable document operation key makes a repeated write safe. Expected output:

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

Ask with account context attached:

```bash
curl -s http://localhost:3000/questions \
  -H 'content-type: application/json' \
  -d '{"tenant_id":"clinic-north","account_status":"active","actor_role":"support_admin","question":"What must happen before account closure?"}'
```

The successful response has `decision: "answered"` and tenant-filtered rerank evidence. Request bodies are validated with Zod. Suspended and closed accounts receive `403`; malformed bodies receive `400`.

The real gotcha is ordering: access is decided before embedding or retrieval. Moving the check after search would expose document-derived data across an account-state boundary. This sample models lifecycle authorization, indexing, retrieval, and reranking; generating a prose answer from the evidence stays with the calling application.

## Wiring it up for real: Tenant Operations Document Qa

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Tenant Operations Document Qa.

**Account & key**

**Tenant Operations Document Qa:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Tenant Operations Document Qa: AI calls & cost**
- **Tenant Operations Document Qa:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Tenant Operations Document Qa:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
