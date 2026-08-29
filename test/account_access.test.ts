import assert from "node:assert/strict";
import test from "node:test";
import { decideDocumentAccess } from "../src/tenant_document_qa.js";

test("a suspended tenant admin cannot query operational documents", () => {
  const decision = decideDocumentAccess({
    tenant_id: "clinic-north",
    account_status: "suspended",
    actor_role: "tenant_admin",
  });

  assert.deepEqual(decision, {
    allowed: false,
    reason: "Account lifecycle state blocks document access",
  });
});

test("an active support admin may query tenant-scoped documents", () => {
  const decision = decideDocumentAccess({
    tenant_id: "clinic-north",
    account_status: "active",
    actor_role: "support_admin",
  });

  assert.equal(decision.allowed, true);
});
