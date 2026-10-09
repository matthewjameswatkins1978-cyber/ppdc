declare module "@astropods/adapter-core" {
  export interface AgentAdapter {
    name: string;
    stream(prompt: string, hooks: { onStatusUpdate(input: { status: string }): void; onChunk(text: string): void; onFinish(): void; onError(error: Error): void }): Promise<void>;
    getConfig(): { systemPrompt: string; tools: unknown[] };
  }
  export function serve(adapter: AgentAdapter): void;
}