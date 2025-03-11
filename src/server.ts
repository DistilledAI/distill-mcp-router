// @ts-nocheck
// eslint-disable-next-line @typescript-eslint/no-var-requires
import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ReadResourceResultSchema,
  ListResourcesResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

const app = express();
const port = 3000;
app.use(express.json());

app.post("/call-mcp", async (req, res) => {
  try {
    const { mcpName, method } = req.body;
    console.log("Requesting resources list...");

    //init client for per mcp
    const pathSourceMcp = `src/${mcpName}/index.ts`;
    const client = new Client(
      {
        name: "example-client",
        version: "1.0.0",
      },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "npx",
      args: ["ts-node", `${pathSourceMcp}`],
    });
    await client.connect(transport);
    console.log("🚀 MCP Client connected!");

    const resources = await client.request(
      { method: method },
      ListResourcesResultSchema
    );
    res.json(resources);
  } catch (error) {
    console.error("Error listing resources:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, async () => {
  console.log(`🚀 Express Server run http://localhost:${port}`);
});
