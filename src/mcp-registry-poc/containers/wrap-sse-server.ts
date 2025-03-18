import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema, ListResourcesResultSchema, ListToolsResultSchema, ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { ZodType } from "zod";
const { spawn } = require('child_process');

const app = express();
const config = require('./sse-server/config.json');

app.use(cors());

let activeTransport: SSEServerTransport;
// Lưu trữ các session đang hoạt động
const activeSessions = new Map();
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

const mcpClient = new Client({
  name: "example-stdio-client",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {},
  },
})

// Hàm tạo sessionId ngẫu nhiên
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Hàm tìm port khả dụng
async function findAvailablePort(startPort = 8000) {
  const net = require('net');

  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });

    server.on('error', () => {
      // Port đã được sử dụng, thử port tiếp theo
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

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

  // Tạo sessionId cho kết nối này
  const sessionId = generateSessionId();

  // Tìm port khả dụng
  const availablePort = await findAvailablePort();

  // Tạo child process từ config

  // Khởi tạo child process với command và args từ config
  const childProcess = spawn(config.command, config.args, {
    env: {
      ...process.env,
      ...clientParams,
      PORT: availablePort
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const waitForServerReady = () => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for child process to start'));
      }, 30000);

      const checkConnection = () => {
        const http = require('http');
        const req = http.get(`http://localhost:${availablePort}/sse`, (res: any) => {
          clearTimeout(timeout);
          if (res.statusCode === 200) {
            console.log(`Child process server is ready on port ${availablePort}`);
            resolve(true);
          } else {
            setTimeout(checkConnection, 1000);
          }
        });

        req.on('error', (err: any) => {
          // Nếu không kết nối được, thử lại sau 1 giây
          setTimeout(checkConnection, 1000);
        });
      };
      checkConnection();
    });
  };

  try {
    await waitForServerReady();

    const transport = new SSEServerTransport(`/messages/${sessionId}`, res);
    const clientTransport = new SSEClientTransport(new URL(`http://localhost:${availablePort}/sse`));

    activeTransport = transport;
    await server.connect(transport);
    await mcpClient.connect(clientTransport);
    console.log(`Server connected to transport with sessionId: ${sessionId}`);

    // Lưu session vào map
    activeSessions.set(sessionId, {
      transport,
      mcpClient,
      port: availablePort,
      childProcess
    });

    // Gửi sessionId về client
    res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);

  } catch (error) {
    console.error("Error connecting server to transport:", error);
    return;
  }

  // Xử lý khi client ngắt kết nối
  req.on("close", () => {
    console.log(`Client disconnected from SSE endpoint, cleaning up session: ${sessionId}`);

    // Dọn dẹp session khi client ngắt kết nối
    if (activeSessions.has(sessionId)) {
      activeSessions.get(sessionId).childProcess.kill();
      activeSessions.delete(sessionId);
    }
  });
});

app.post("/messages/:sessionId", async (req: any, res: any) => {
  const { method, params } = req.body;
  const sessionId = req.params.sessionId;
  // Lấy client từ session
  const session = activeSessions.get(sessionId);
  const client = session.mcpClient;

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
    const result = await client.request(
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
  catch (err: any) {
    console.error("error", err);
    res.status(500).json({
      error: err.message || "Internal server error"
    });
  }
})
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
