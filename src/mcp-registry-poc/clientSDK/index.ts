import axios from 'axios';
import { EventSource } from "eventsource";

class MCPClientRegistry {
  private registryUrl: string;
  private eventSource: EventSource | null = null;
  private messageHandlers: ((data: any) => void)[] = [];
  private clientParams: any;
  private _sessionId: string;
  constructor(registryUrl: string = 'http://localhost:3001', clientParams: any = {}) {
    this.registryUrl = registryUrl;
    this.clientParams = clientParams;
    this._sessionId = ''
  }

  get sessionId(): string {
    return this._sessionId;
  }

  async connectToServer(path: string): Promise<boolean> {
    if (this.eventSource) {
      this.disconnect();
    }
    try {
      const sseUrl = new URL(`${this.registryUrl}/${path}`);

      Object.entries(this.clientParams).forEach(([key, value]) => {
        sseUrl.searchParams.append(key, String(value));
      });

      this.eventSource = new EventSource(sseUrl.toString());

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout waiting for sessionId'));
          this.disconnect();
        }, 60000);

        this.eventSource!.onopen = () => {
          console.log(`Đã kết nối thành công đến ${this.registryUrl}`);
        };

        this.eventSource!.onerror = (error) => {
          clearTimeout(timeoutId);
          this.disconnect();
          reject(error);
        };

        this.eventSource!.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`Nhận tin nhắn từ server:`, data);

            if (data.sessionId) {
              this._sessionId = data.sessionId;
              console.log(`Đã nhận sessionId: ${this._sessionId}`);

              clearTimeout(timeoutId);
              resolve(true);
            }

            this.messageHandlers.forEach(handler => handler(data));
          } catch (error) {
            console.error('Lỗi khi xử lý tin nhắn:', error);
          }
        };
      });
    } catch (error) {
      console.error(`Lỗi khi kết nối đến server`, error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('Đã ngắt kết nối khỏi server');
    }
  }

  onMessage(handler: (data: any) => void): void {
    this.messageHandlers.push(handler);
  }

  async sendRequest(requestData: any): Promise<any> {
    try {
      if (!this.sessionId) {
        throw new Error('Session ID is not set');
      }
      const url = `${this.registryUrl}/messages/${this.sessionId}`;
      const response = await axios.post(url, requestData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Lỗi khi gửi request đến server`, error);
      throw error;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    Object.entries(this.clientParams).forEach(([key, value]) => {
      headers[key] = String(value);
    });

    return headers;
  }

  async listTools(): Promise<any> {
    const request = {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 4,
      params: {}
    };

    return this.sendRequest(request);
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const request = {
      jsonrpc: "2.0",
      method: "tools/call",
      id: Math.random().toString(36).substring(2, 9),
      params: {
        name: toolName,
        arguments: args
      }
    };

    return this.sendRequest(request);
  }

  async listResources(): Promise<any> {
    const request = {
      jsonrpc: "2.0",
      method: "resources/list",
      id: Math.random().toString(36).substring(2, 9),
      params: {}
    };

    return this.sendRequest(request);
  }

  async readResource(resourceId: string): Promise<any> {
    const request = {
      jsonrpc: "2.0",
      method: "resources/read",
      id: Math.random().toString(36).substring(2, 9),
      params: {
        id: resourceId
      }
    };

    return this.sendRequest(request);
  }
}

export default MCPClientRegistry;
