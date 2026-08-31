import type { WebMcpTool } from "./webMcpTypes";

export function assertUniqueToolNames(tools: readonly WebMcpTool[]): void {
  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) throw new Error(`Duplicate WebMCP tool name: ${tool.name}`);
    names.add(tool.name);
  }
}
