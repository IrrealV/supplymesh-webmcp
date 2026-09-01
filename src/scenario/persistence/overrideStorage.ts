import { isVehicleLabelValid } from "../../domain/entities";
import type { OperationalRecoverySnapshot } from "../../domain/recovery/recoveryContracts";
import { isOperationalRecoverySnapshot } from "../../domain/recovery/recoveryValidation";

export const SCENARIO_OVERRIDES_STORAGE_KEY = "scenario-overrides:v1";
const SCENARIO_OVERRIDES_VERSION = 1;

export type ScenarioOverrides = { version: 1; labels: Record<string, string>; deletedVehicleIds: string[]; operationalSnapshot?: OperationalRecoverySnapshot; recoveryRouteApplied?: true };
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const emptyOverrides = (): ScenarioOverrides => ({ version: SCENARIO_OVERRIDES_VERSION, labels: {}, deletedVehicleIds: [] });

function isLabelRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && Object.values(value).every((entry) => typeof entry === "string" && isVehicleLabelValid(entry));
}

function isScenarioOverrides(value: unknown): value is ScenarioOverrides {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { version?: unknown; labels?: unknown; deletedVehicleIds?: unknown; operationalSnapshot?: unknown; recoveryRouteApplied?: unknown };
  const hasRecovery = candidate.operationalSnapshot !== undefined || candidate.recoveryRouteApplied !== undefined;
  return candidate.version === SCENARIO_OVERRIDES_VERSION
    && isLabelRecord(candidate.labels)
    && Array.isArray(candidate.deletedVehicleIds)
    && candidate.deletedVehicleIds.every((id) => typeof id === "string")
    && (!hasRecovery || (candidate.recoveryRouteApplied === true && isOperationalRecoverySnapshot(candidate.operationalSnapshot)));
}

export function loadScenarioOverrides(storage: StorageLike): ScenarioOverrides {
  const serialized = storage.getItem(SCENARIO_OVERRIDES_STORAGE_KEY);
  if (serialized === null) return emptyOverrides();
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isScenarioOverrides(parsed)) return emptyOverrides();
    const normalized: ScenarioOverrides = { version: SCENARIO_OVERRIDES_VERSION, labels: Object.fromEntries(Object.entries(parsed.labels).map(([id, label]) => [id, label.trim()])), deletedVehicleIds: [...new Set(parsed.deletedVehicleIds)] };
    return parsed.recoveryRouteApplied === true && parsed.operationalSnapshot !== undefined
      ? { ...normalized, recoveryRouteApplied: true, operationalSnapshot: structuredClone(parsed.operationalSnapshot) }
      : normalized;
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
    return globalThis.localStorage ?? { getItem: () => null, setItem: () => undefined };
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}
