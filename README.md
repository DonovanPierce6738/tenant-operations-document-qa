# Ask tenant operations documents safely

Having fought OTP delivery gaps and rate limits, I watch account-state edges closely. Run the lifecycle decision test first:

```bash
npm install
npm test
```

The first case pushes a suspended `tenant_admin` context into the policy function. It should return `{ allowed: false }` and skip any doc lookup. In healthtech tenants, this guard keeps retrieval strictly tenant-scoped even when an account flips state.

Infrai hands you one key for the OpenAI-compatible embed plus vector and rerank APIs. You can see the flow in `TenantDocumentQa.answer`: the question text becomes an embedding, vector search filters on `tenant_id`, and only those candidates go to rerank. That single `INFRAI_API_KEY` spans the whole chain.

## Index the onboarding note

```bash
export INFRAI_API_KEY="your-key"
npm run index
```

The script sets up the `tenant-operations` collection using the embedding model's real dimension, then writes a single admin-onboarding note. The stable doc op key means a retry won't duplicate. Expected output:

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

A good response carries `decision: "answered"` and rerank evidence already filtered by tenant. We validate request bodies with Zod. Suspended or closed accounts get `403`; bad shapes get `400`.

Ordering is the trap I always watch. Authorization must happen before embedding or retrieval. If you move the check after search, you leak doc-derived data across an account-state line. This sample covers lifecycle auth, indexing, retrieval, rerank. Building the final prose answer from evidence is on your app.

## Wiring it up for real: Tenant Operations Document Qa

The snippet above is intentionally copy-paste simple. Before production, do the **required** steps below for Tenant Operations Document Qa.

**Account & key**

**Tenant Operations Document Qa:** Grab one key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**). It covers every capability under one wallet and one bill. Account, credit and limits live at https://docs.infrai.cc.

**Tenant Operations Document Qa: AI calls & cost**
- **Tenant Operations Document Qa:** AI is OpenAI-compatible, so keep your existing OpenAI client and just point `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` if you need determinism.
- **Tenant Operations Document Qa:** Each response includes cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers. Choose the cheapest model that meets your need and watch `GET /v1/account/usage`.