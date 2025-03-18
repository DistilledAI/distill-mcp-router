import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema, ListResourcesResultSchema, ListToolsResultSchema, ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { ZodType } from "zod";

const app = express();
const config = require('./stdio-server/config.json');

app.use(cors());

let activeTransport: SSEServerTransport;
// Khởi tạo server MCP
const server = new Server({
  name: "example-stdio-server",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  }
});

// Hàm tạo sessionId ngẫu nhiên
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


const sessions = new Map<string, { client: Client }>();

const mcpClient = new Client({
  name: "example-stdio-client",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {},
  },
})

console.log('Starting server...');
app.use(express.json());

app.get("/sse", async (req: any, res: any) => {
  console.log("Client connected to SSE endpoint");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const clientParams = req.query;
  // verify params
  const envs = config["env"];
  if (envs) {
    for (const key of Object.keys(envs)) {
      if (envs[key] === 'required' && !clientParams[key]) {
        return res.status(401).json({ "message": "Unauthorization" })
      }
    }
  }

  const sessionId = generateSessionId();
  const transport = new SSEServerTransport(`/messages/${sessionId}`, res);
  const transportClient = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: {
      ...process.env,
      ...clientParams,
    }
  });
  try {
    activeTransport = transport;
    await server.connect(transport);
    await mcpClient.connect(transportClient);
    sessions.set(sessionId, { client: mcpClient });
    console.log("Server connected to transport");
    res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);
  } catch (error) {
    console.error("Error connecting server to transport:", error);
    return;
  }

  // Xử lý khi client ngắt kết nối
  req.on("close", () => {
    console.log("Client disconnected from SSE endpoint");
    sessions.delete(sessionId);
  });
});

app.post("/messages/:sessionId", async (req: any, res: any) => {
  const { method, params } = req.body;
  let schema;
  try {
    if (method === "tools/list") {
      schema = ListToolsResultSchema;
    } else if (method === "tools/call") {
      schema = CallToolResultSchema;
    } else if (method === "resources/list") {
      schema = ListResourcesResultSchema;
    } else if (method === "resources/read") {
      schema = ReadResourceResultSchema;
    }
    const sessionId = req.params.sessionId;
    const result = await sessions.get(sessionId)?.client.request(
      {
        method: method,
        params: params
      },
      schema as ZodType<any>
    )
    res.status(200).json({
      result: result,
    });
  }
  catch (err) {
    console.error("error", err);
  }
})
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

