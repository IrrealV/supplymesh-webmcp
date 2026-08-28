export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: "string"; minLength: number }>;
  required?: string[];
  additionalProperties: false;
};

export type WebMcpToolResponse = {
  content: [{ type: "text"; text: string }];
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute(input: unknown): WebMcpToolResponse;
};

export type ModelContext = {
  registerTool(tool: WebMcpTool, options: { signal: AbortSignal }): Promise<void> | void;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}
