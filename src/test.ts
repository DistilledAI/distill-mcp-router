import axios from "axios";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { createTransport } from "@smithery/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

(async () => {
  // const functionIds = await createFunctionHub();
  // console.log(functionIds);
  // await useFunctionHub("0x0b008f3190069c204d1588564d8d8535f18e8fad");

  const transport = createTransport(
    "https://server.smithery.ai/@smithery-ai/server-sequential-thinking",
    {}
  );

  // Create MCP client

  const client = new Client({
    name: "Test client",
    version: "1.0.0",
  });
  await client.connect(transport);

  // Use the server tools with your LLM application
  const tools = await client.listTools();
  console.log(`Available tools: ${JSON.stringify(tools, null, 2)}`);

  // console.log(`Available tools: ${tools.map((t: any) => t.name).join(", ")}`)
})();

// Example: Call a tool
// const result = await client.callTool("tool_name", { param1: "value1" })
