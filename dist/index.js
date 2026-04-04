"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AClient = exports.A2AServer = void 0;
exports.createAgentCard = createAgentCard;
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
class A2AServer {
    constructor(options) {
        this.server = null;
        this.port = options.port;
        this.agentCard = options.agentCard;
        this.taskHandler = options.taskHandler;
        this.authMiddleware = options.authMiddleware;
        this.errorHandler = options.errorHandler;
        this.logLevel = options.logLevel || 'info';
        this.startTime = Date.now();
    }
    log(level, message) {
        const levels = ['debug', 'info', 'warn', 'error'];
        if (levels.indexOf(level) >= levels.indexOf(this.logLevel)) {
            console.log(`[${level.toUpperCase()}] ${message}`);
        }
    }
    async start() {
        this.server = http_1.default.createServer(async (req, res) => {
            try {
                const url = new url_1.URL(req.url || '/', `http://localhost:${this.port}`);
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
                    const task = {
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
                    const task = {
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
            }
            catch (error) {
                this.log('error', `Server error: ${error}`);
                if (this.errorHandler) {
                    this.errorHandler(error);
                }
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
        });
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                this.log('info', `A2A Server started on port ${this.port}`);
                resolve();
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.log('info', 'A2A Server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    getStatus() {
        return {
            running: this.server !== null,
            port: this.port,
            uptime: Date.now() - this.startTime,
        };
    }
}
exports.A2AServer = A2AServer;
class A2AClient {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
    }
    async fetchWithRetry(url, options, attempt = 0) {
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
        }
        catch (error) {
            if (attempt < this.retryAttempts) {
                await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }
    async discoverAgents(serverUrl) {
        const url = `${serverUrl}/.well-known/agent.json`;
        const agentCard = await this.fetchWithRetry(url, { method: 'GET' });
        return [agentCard];
    }
    async sendTask(request) {
        const url = `${request.agentId}/tasks/send`;
        return this.fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ params: request.params }),
        });
    }
    async *sendTaskStreaming(request) {
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
            if (done)
                break;
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
exports.A2AClient = A2AClient;
function createAgentCard(partial) {
    return {
        defaultInputModes: ['application/json', 'text/plain'],
        defaultOutputModes: ['application/json', 'text/plain'],
        ...partial,
    };
}
