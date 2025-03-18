import MCPClientRegistry from "./clientSDK";

async function example() {
  const client = new MCPClientRegistry('http://localhost:3001', {
    MCP_CLIENT_NAME: 'Test Client',
    MCP_CLIENT_VERSION: '1.0.0'
  });

  try {
    await client.connectToServer("sse");
    console.log("Connected to server, sessionId: ", client.sessionId);

    client.onMessage((data) => {
      console.log('Xử lý tin nhắn:', data);
    });

    const toolsResponse = await client.listTools();
    console.log('Tools có sẵn:', JSON.stringify(toolsResponse));

    if (toolsResponse?.result?.tools?.some((tool: any) => tool.name === 'Calculate')) {
      const calcResult = await client.callTool('Calculate', {
        expression: 'add',
        a: 10,
        b: 20
      });
      console.log('Kết quả tính toán:', JSON.stringify(calcResult));
    }
  } catch (error) {
    console.error('Lỗi:', error);
  }
}

if (require.main === module) {
  example();
}
