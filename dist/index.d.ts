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
export declare class A2AServer {
    private server;
    private agentCard;
    private taskHandler;
    private authMiddleware?;
    private errorHandler?;
    private logLevel;
    private startTime;
    private port;
    constructor(options: ServerOptions);
    private log;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): ServerStatus;
}
export declare class A2AClient {
    private timeout;
    private retryAttempts;
    private retryDelay;
    constructor(options?: ClientOptions);
    private fetchWithRetry;
    discoverAgents(serverUrl: string): Promise<AgentCard[]>;
    sendTask(request: TaskRequest): Promise<Task>;
    sendTaskStreaming(request: TaskRequest): AsyncGenerator<Task>;
}
export declare function createAgentCard(partial: Partial<AgentCard> & Pick<AgentCard, 'id' | 'name' | 'description' | 'url' | 'version' | 'capabilities' | 'skills'>): AgentCard;
