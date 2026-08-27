export const SCENARIO_OVERRIDES_STORAGE_KEY = "scenario-overrides:v1";
const SCENARIO_OVERRIDES_VERSION = 1;

export type ScenarioOverrides = { version: 1; labels: Record<string, string>; deletedVehicleIds: string[] };
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const emptyOverrides = (): ScenarioOverrides => ({ version: SCENARIO_OVERRIDES_VERSION, labels: {}, deletedVehicleIds: [] });

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && Object.values(value).every((entry) => typeof entry === "string");
}

function isScenarioOverrides(value: unknown): value is ScenarioOverrides {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { version?: unknown; labels?: unknown; deletedVehicleIds?: unknown };
  return candidate.version === SCENARIO_OVERRIDES_VERSION && isStringRecord(candidate.labels) && Array.isArray(candidate.deletedVehicleIds) && candidate.deletedVehicleIds.every((id) => typeof id === "string");
}

export function loadScenarioOverrides(storage: StorageLike): ScenarioOverrides {
  const serialized = storage.getItem(SCENARIO_OVERRIDES_STORAGE_KEY);
  if (serialized === null) return emptyOverrides();
  try {
    const parsed: unknown = JSON.parse(serialized);
    return isScenarioOverrides(parsed) ? { version: SCENARIO_OVERRIDES_VERSION, labels: { ...parsed.labels }, deletedVehicleIds: [...new Set(parsed.deletedVehicleIds)] } : emptyOverrides();
  } catch {
    return emptyOverrides();
  }
}

export function saveScenarioOverrides(storage: StorageLike, overrides: ScenarioOverrides): boolean {
  try {
    storage.setItem(SCENARIO_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): StorageLike {
  try {
    return globalThis.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}
