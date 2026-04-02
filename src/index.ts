export interface Part {
  type: 'text' | 'image' | 'file';
  text?: string;
  mimeType?: string;
  data?: string;
}

export interface Message {
  role: 'user' | 'agent';
  parts: Part[];
}

export interface TaskParams {
  prompt: string;
  context?: Record<string, unknown>;
  sessionId?: string;
}

export interface Task {
  id: string;
  status: TaskStatus;
  history?: Message[];
}

export interface TaskStatus {
  state: 'pending' | 'submitted' | 'working' | 'completed' | 'failed' | 'canceled';
  message?: Message;
  artifacts?: Artifact[];
}

export interface Artifact {
  name?: string;
  mimeType?: string;
  parts: Part[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  inputModes: string[];
  outputModes: string[];
}

export interface AgentCapabilities {
  streaming: boolean;
  pushNotifications: boolean;
}

export interface Authentication {
  schemes: string[];
  credentials?: string;
}

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapabilities;
  skills: Skill[];
  authentication?: Authentication;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

export interface TaskRequest {
  agentId: string;
  params: TaskParams;
}

export interface ServerOptions {
  port: number;
  agentCard: AgentCard;
  taskHandler: TaskHandler;
  authMiddleware?: AuthMiddleware;
  errorHandler?: ErrorHandler;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export type TaskHandler = (task: Task) => Promise<Task>;
export type AuthMiddleware = (req: Request) => Promise<boolean>;
export type ErrorHandler = (error: Error) => void;

export interface ClientOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  uptime: number;
}

import http from 'http';
import { URL } from 'url';

export class A2AServer {
  private server: http.Server | null = null;
  private agentCard: AgentCard;
  private taskHandler: TaskHandler;
  private authMiddleware?: AuthMiddleware;
  private errorHandler?: ErrorHandler;
  private logLevel: string;
  private startTime: number;
  private port: number;

  constructor(options: ServerOptions) {
    this.port = options.port;
    this.agentCard = options.agentCard;
    this.taskHandler = options.taskHandler;
    this.authMiddleware = options.authMiddleware;
    this.errorHandler = options.errorHandler;
    this.logLevel = options.logLevel || 'info';
    this.startTime = Date.now();
  }

  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) >= levels.indexOf(this.logLevel)) {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  async start(): Promise<void> {
    this.server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://localhost:${this.port}`);

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Agent Card endpoint
        if (url.pathname === '/.well-known/agent.json') {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify(this.agentCard));
          return;
        }

        // Tasks endpoint
        if (url.pathname === '/tasks/send' && req.method === 'POST') {
          if (this.authMiddleware) {
            const authResult = await this.authMiddleware(req);
            if (!authResult) {
              res.writeHead(401);
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }
          }

          let body = '';
          for await (const chunk of req) {
            body += chunk;
          }

          const taskRequest = JSON.parse(body);
          const task: Task = {
            id: taskRequest.id || `task-${Date.now()}`,
            status: { state: 'working' },
          };

          const result = await this.taskHandler(task);

          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify(result));
          return;
        }

        // Tasks streaming endpoint
        if (url.pathname === '/tasks/send/stream' && req.method === 'POST') {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          let body = '';
          for await (const chunk of req) {
            body += chunk;
          }

          const taskRequest = JSON.parse(body);
          const task: Task = {
            id: taskRequest.id || `task-${Date.now()}`,
            status: { state: 'working' },
          };

          // Simulate streaming by sending task updates
          res.write(`data: ${JSON.stringify({ type: 'task', state: 'working' })}\n\n`);
          
          const result = await this.taskHandler(task);
          res.write(`data: ${JSON.stringify({ type: 'task', state: 'completed', result })}\n\n`);
          res.end();
          return;
        }

        // 404 for unknown paths
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found' }));
      } catch (error) {
        this.log('error', `Server error: ${error}`);
        if (this.errorHandler) {
          this.errorHandler(error as Error);
        }
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        this.log('info', `A2A Server started on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.log('info', 'A2A Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getStatus(): ServerStatus {
    return {
      running: this.server !== null,
      port: this.port,
      uptime: Date.now() - this.startTime,
    };
  }
}

export class A2AClient {
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(options: ClientOptions = {}) {
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  private async fetchWithRetry<T>(url: string, options: RequestInit, attempt = 0): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async discoverAgents(serverUrl: string): Promise<AgentCard[]> {
    const url = `${serverUrl}/.well-known/agent.json`;
    const agentCard = await this.fetchWithRetry<AgentCard>(url, { method: 'GET' });
    return [agentCard];
  }

  async sendTask(request: TaskRequest): Promise<Task> {
    const url = `${request.agentId}/tasks/send`;
    return this.fetchWithRetry<Task>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: request.params }),
    });
  }

  async *sendTaskStreaming(request: TaskRequest): AsyncGenerator<Task> {
    const url = `${request.agentId}/tasks/send/stream`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: request.params }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.result) {
            yield data.result;
          }
        }
      }
    }
  }
}

export function createAgentCard(partial: Partial<AgentCard> & Pick<AgentCard, 'id' | 'name' | 'description' | 'url' | 'version' | 'capabilities' | 'skills'>): AgentCard {
  return {
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    ...partial,
  };
}