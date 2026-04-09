# Agent A2A Bridge

[![Build](https://github.com/Retsumdk/agent-a2a-bridge/workflows/CI/badge.svg)](https://github.com/Retsumdk/agent-a2a-bridge/actions)


A production-ready implementation of Google's Agent-to-Agent (A2A) protocol for building multi-agent AI systems. This library provides a complete A2A client and server implementation that enables agents to discover, communicate, and collaborate with each other across different platforms and frameworks.

## 🌟 Features

- **Complete A2A Protocol Support**: Full implementation of the A2A specification including agent discovery, task delegation, and result streaming
- **Bidirectional Communication**: Agents can act as both client and server
- **Task Management**: Create, track, and manage tasks across agent boundaries
- **Streaming Responses**: Real-time streaming of task results using Server-Sent Events (SSE)
- **Agent Card Discovery**: JSON Agent Card format for advertising agent capabilities
- **Production-Ready**: TypeScript implementation with full type safety, error handling, and retry logic
- **Extensible**: Easy to add custom authentication, logging, and monitoring

## 📦 Installation

```bash
npm install a2a-bridge
# or
pnpm add a2a-bridge
# or
yarn add a2a-bridge
```

## 🚀 Quick Start

### Starting an A2A Server (Agent)

```typescript
import { A2AServer, AgentCard, TaskHandler } from 'a2a-bridge';

const agentCard: AgentCard = {
  id: 'data-processing-agent',
  name: 'Data Processing Agent',
  description: 'Processes and transforms data from various sources',
  url: 'http://localhost:3000',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  skills: [
    {
      id: 'data-transformation',
      name: 'Data Transformation',
      description: 'Transform data between different formats',
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'data-validation',
      name: 'Data Validation',
      description: 'Validate data against schemas',
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    },
  ],
};

const taskHandler: TaskHandler = async (task) => {
  const { params } = task;
  const { prompt, context } = params;

  // Process the task
  const result = await processData(prompt, context);

  return {
    id: task.id,
    status: {
      state: 'completed',
      message: { role: 'agent', parts: [{ type: 'text', text: result }] },
    },
  };
};

const server = new A2AServer({
  port: 3000,
  agentCard,
  taskHandler,
});

server.start();
console.log('A2A Server running on http://localhost:3000');
```

### Connecting as an A2A Client

```typescript
import { A2AClient } from 'a2a-bridge';

const client = new A2AClient();

// Discover agents
const agents = await client.discoverAgents('http://localhost:3000');
console.log('Discovered agents:', agents);

// Send a task
const task = await client.sendTask({
  agentId: 'data-processing-agent',
  params: {
    prompt: 'Transform this data to JSON',
    context: { format: 'csv' },
  },
});

console.log('Task result:', task.result);
```

## 📚 Architecture

```
┌─────────────┐      A2A Protocol      ┌─────────────┐
│   Agent A   │◄──────────────────────►│   Agent B   │
│  (Client)   │   - Task Delegation    │  (Server)   │
│             │   - Result Streaming   │             │
│             │   - Agent Discovery    │             │
└─────────────┘                        └─────────────┘
```

### Core Components

1. **A2AServer**: HTTP server that exposes agent capabilities via A2A protocol
2. **A2AClient**: Client for discovering and communicating with A2A agents
3. **AgentCard**: JSON metadata describing agent capabilities
4. **Task**: Unit of work passed between agents
5. **Message**: Communication unit within tasks

## 🔧 Configuration

### Server Options

```typescript
const server = new A2AServer({
  port: 3000,                    // HTTP port
  agentCard,                    // Agent metadata
  taskHandler,                  // Task processing function
  authMiddleware,               // Optional auth
  errorHandler,                // Custom error handling
  logLevel: 'info',            // Logging level
});
```

### Client Options

```typescript
const client = new A2AClient({
  timeout: 30000,               // Request timeout
  retryAttempts: 3,            // Retry failed requests
  retryDelay: 1000,            // Delay between retries
});
```

## 📖 API Reference

### A2AServer

```typescript
// Start the server
server.start(): Promise<void>

// Stop the server
server.stop(): Promise<void>

// Get server status
server.getStatus(): ServerStatus
```

### A2AClient

```typescript
// Discover agents from a server
client.discoverAgents(serverUrl: string): Promise<AgentCard[]>

// Send a task and wait for completion
client.sendTask(request: TaskRequest): Promise<Task>

// Send a task with streaming results
client.sendTaskStreaming(request: TaskRequest): AsyncGenerator<Task>
```

### AgentCard

```typescript
interface AgentCard {
  id: string;                  // Unique agent identifier
  name: string;               // Human-readable name
  description: string;        // Agent description
  url: string;               // Agent endpoint URL
  version: string;           // Protocol version
  capabilities: {
    streaming: boolean;      // Supports SSE streaming
    pushNotifications: boolean;
  };
  skills: Skill[];           // Agent capabilities
  authentication?: Authentication;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}
```

## 🔐 Authentication

```typescript
const server = new A2AServer({
  // ...
  authMiddleware: async (req) => {
    const token = req.headers.authorization;
    if (!token) throw new Error('Unauthorized');
    return verifyToken(token);
  },
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Related Resources

- [A2A Protocol Specification](https://github.com/google/A2A)
- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [MCP vs A2A Comparison](https://www.digitalocean.com/community/tutorials/a2a-vs-mcp-ai-agent-protocols)