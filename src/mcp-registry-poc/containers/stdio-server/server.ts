import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

console.log('Starting server...');

const server = new Server({
  name: "example-stdio-server",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {}
  }
});

function mathTool(expression: string, a: number, b: number) {
  if (expression === "add") {
    return a + b;
  } else if (expression === "subtract") {
    return a - b;
  } else if (expression === "multiply") {
    return a * b;
  } else if (expression === "divide") {
    return a / b;
  } else {
    throw new Error("Invalid expression");
  }
}

async function bootstrap() {

  const TOOLS: Tool[] = [
    {
      name: "Calculate",
      description: "Calculate the result of a mathematical expression",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string", description: "The mathematical expression to calculate" },
          a: { type: "number", description: "The first number to calculate" },
          b: { type: "number", description: "The second number to calculate" },
        },
        required: ["expression", "a", "b"]
      }
    }
  ]
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });


  // call tool
  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const tool = TOOLS.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error("Tool not found");
    }

    switch (request.params.name) {
      case "Calculate":
        const { expression, a, b } = request.params.arguments as { expression: string, a: number, b: number };
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              result: mathTool(expression, a, b),
              name: process.env.MCP_CLIENT_NAME,
            }, null, 2)
          }],
          isError: false
        }
      default:
        throw new Error("Tool not found");
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Server connected and ready!');
}

bootstrap();