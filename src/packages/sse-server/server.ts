import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingMessage } from "http";
import { Readable } from "stream";

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

const app = express();
app.use(cors());
console.log('Starting server...');
app.use(express.json());

let transport: SSEServerTransport;



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

  app.get('/sse', async (req: any, res: any) => {
    console.log("Client connected to SSE endpoint");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  })

  app.post('/messages', async (req: any, res: any) => {

    // handle request to readable resource
    const body = req.body;
    console.log("POST /messages body:", body);

    // Reconstruct the request stream from the parsed body
    const rawBody = JSON.stringify(body);
    const newReqStream = Readable.from(rawBody);

    const newReq: IncomingMessage = Object.assign(newReqStream, {
      headers: req.headers,
      method: req.method,
      url: req.url,
      // Required IncomingMessage properties with defaults or copied values
      aborted: req.destroyed ?? false,
      httpVersion: req.httpVersion ?? "1.1",
      httpVersionMajor: req.httpVersionMajor ?? 1,
      httpVersionMinor: req.httpVersionMinor ?? 1,
      complete: req.complete ?? true,
      rawHeaders: req.rawHeaders ?? [],
      socket: req.socket, // Pass the original socket (might be needed)
      connection: req.socket, // Alias for socket
      // Add other properties if needed by handlePostMessage
    }) as IncomingMessage;
    try {
      await transport.handlePostMessage(newReq, res);
    } catch (error) {
      console.error("Error in POST /messages:", error);
      res
        .status(400)
        .json({ error: "Failed to process message", details: (error as Error).message });
    }
  })

  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
  })
}

bootstrap();