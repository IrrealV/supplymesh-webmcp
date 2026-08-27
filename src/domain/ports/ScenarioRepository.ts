import type { OperatingRegion, Vehicle } from "../entities";

export type ScenarioRepository = {
  scenarioCurrent(): OperatingRegion;
  vehicleGet(vehicleId: string): Vehicle | undefined;
  vehicleRename(vehicleId: string, label: string): Vehicle | undefined;
  vehicleDelete(vehicleId: string): Vehicle | undefined;
};
