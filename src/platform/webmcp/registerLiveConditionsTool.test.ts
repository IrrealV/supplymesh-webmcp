import { describe, expect, it, vi } from "vitest";
import { createLiveConditionsStore } from "../../live/liveConditions";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { createLiveConditionsTool } from "./registerLiveConditionsTool";

async function result(tool: ReturnType<typeof createLiveConditionsTool>, input: unknown): Promise<unknown> {
  const envelope = await tool.execute(input);
  return JSON.parse(envelope.content[0].text) as unknown;
}

describe("createLiveConditionsTool", () => {
  it("exposes a strict advisory schema and enables the visible live layer while refreshing", async () => {
    const fetchWeather = vi.fn().mockResolvedValue({ observations: [], airQualityAvailable: false });
    const fetchTraffic = vi.fn().mockResolvedValue({ incidents: [], nationalIncidentCount: 0, feedPublishedAt: null });
    const store = createLiveConditionsStore(
      () => ({ ok: true, data: createSpainScenario() }),
      { fetchImpl: vi.fn<typeof fetch>(), fetchWeather, fetchTraffic },
    );
    const tool = createLiveConditionsTool(store);

    expect(tool.name).toBe("live_conditions_get");
    expect(tool.inputSchema).toEqual({ type: "object", properties: { refresh: { type: "boolean" } }, additionalProperties: false });
    expect(await result(tool, { refresh: true })).toMatchObject({ ok: true, data: { advisoryOnly: true, enabled: true } });
    expect(store.read().enabled).toBe(true);
    expect(fetchWeather).toHaveBeenCalledTimes(1);
    expect(fetchTraffic).toHaveBeenCalledTimes(1);
    expect(await result(tool, { refresh: true, unsafeOverride: true })).toEqual({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid." } });
    store.dispose();
  });
});
