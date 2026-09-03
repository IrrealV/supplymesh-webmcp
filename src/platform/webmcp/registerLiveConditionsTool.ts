import { liveConditionsForAgent, type LiveConditionsStore } from "../../live/liveConditions";
import type { WebMcpTool, WebMcpToolResponse } from "./webMcpTypes";

const liveConditionsInputSchema = {
  type: "object" as const,
  properties: {
    refresh: { type: "boolean" },
  },
  additionalProperties: false as const,
};

function response(value: unknown): WebMcpToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function isInput(value: unknown): value is { refresh?: boolean } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => key === "refresh")) return false;
  return record.refresh === undefined || typeof record.refresh === "boolean";
}

export function createLiveConditionsTool(store: LiveConditionsStore): WebMcpTool {
  return {
    name: "live_conditions_get",
    description: "Reads current advisory weather across the fleet and route-relevant DGT traffic incidents. Set refresh=true to request the public providers. This tool never changes routes, plans, constraints, or human approvals.",
    inputSchema: liveConditionsInputSchema,
    async execute(input: unknown): Promise<WebMcpToolResponse> {
      if (!isInput(input)) return response({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid." } });
      try {
        const snapshot = input.refresh === true ? await store.refresh(true) : store.read();
        return response({ ok: true, data: liveConditionsForAgent(snapshot) });
      } catch {
        return response({ ok: false, error: { code: "provider-unavailable", message: "Live weather and traffic could not be read." } });
      }
    },
  };
}
