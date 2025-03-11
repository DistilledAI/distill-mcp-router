import { createTransport } from "@smithery/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

async function run() {
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
  const tools: any = await client.listTools();
  console.log(`Available tools:  ${JSON.stringify(tools)}`);

  // Example: Call a tool
  // const result = await client.callTool("tool_name", { param1: "value1" })
}
run();
