import type { OperatingRegion, Vehicle } from "../entities";

export type ScenarioRepository = {
  scenarioCurrent(): OperatingRegion;
  scenarioRegionSelect(regionId: string): OperatingRegion | undefined;
  vehicleGet(vehicleId: string): Vehicle | undefined;
  vehicleRename(vehicleId: string, label: string): Vehicle | undefined;
  vehicleDelete(vehicleId: string): Vehicle | undefined;
  vehicleCreate(vehicle: Vehicle): Vehicle;
  vehicleUpdate(vehicleId: string, updates: Partial<Vehicle>): Vehicle | undefined;
  vehicleAssignRoute(vehicleId: string, routeId: string | undefined): Vehicle | undefined;
};
