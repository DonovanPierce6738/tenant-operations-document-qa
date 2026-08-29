import { createServer } from "node:http";
import { ZodError, type ZodType } from "zod";
import { InfraiDocumentClient, InfraiError } from "./infrai_document_client.js";
import {
  IndexRequestSchema,
  QuestionRequestSchema,
  TenantDocumentQa,
} from "./tenant_document_qa.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const qa = new TenantDocumentQa(
  new InfraiDocumentClient(apiKey),
  process.env.INFRAI_COLLECTION ?? "tenant-operations",
);

async function readBody<T>(request: import("node:http").IncomingMessage, schema: ZodType<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/documents") {
      send(response, 201, await qa.indexDocument(await readBody(request, IndexRequestSchema)));
      return;
    }
    if (request.method === "POST" && request.url === "/questions") {
      const result = await qa.answer(await readBody(request, QuestionRequestSchema));
      send(response, result.decision === "denied" ? 403 : 200, result);
      return;
    }
    send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, detail: error.detail });
      return;
    }
    send(response, 500, { error: "Internal service error" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log("Tenant document QA listening on http://localhost:3000");
});
