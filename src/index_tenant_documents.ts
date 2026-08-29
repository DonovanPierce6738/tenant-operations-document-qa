import { InfraiDocumentClient } from "./infrai_document_client.js";
import { TenantDocumentQa } from "./tenant_document_qa.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before indexing documents");

const qa = new TenantDocumentQa(new InfraiDocumentClient(apiKey), "tenant-operations");
await qa.prepareCollection();
console.log(
  await qa.indexDocument({
    tenant_id: "clinic-north",
    document_id: "onboarding-2026",
    title: "Administrator onboarding",
    text: "A tenant admin verifies the workspace owner, records the data steward, and activates the account.",
  }),
);
