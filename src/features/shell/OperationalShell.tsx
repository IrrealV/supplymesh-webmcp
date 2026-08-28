import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { OperatingRegion } from "../../domain/entities";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { FilterRail } from "../fleet/FilterRail";
import { VehicleDrawer } from "../fleet/VehicleDrawer";
import { FleetMap } from "../map/FleetMap";
import { Topbar } from "./Topbar";

export function OperationalShell({ locale, onLocaleChange, onScenarioChange, operations, scenario }: { locale: Locale; onLocaleChange(locale: Locale): void; onScenarioChange(scenario: OperatingRegion): void; operations: OperationsApi; scenario: OperatingRegion }) {
  const drawerOpen = useUiCoordinationStore((state) => state.drawerOpen);
  const isFollowing = useUiCoordinationStore((state) => state.isFollowing);
  const selectedVehicleId = useUiCoordinationStore((state) => state.selectedVehicleId);
  const selectedVehicle = scenario.vehicles.find((vehicle) => vehicle.internalId === selectedVehicleId);
  const copy = catalog(locale);
  return (
    <main className="console-shell">
      <Topbar locale={locale} onLocaleChange={onLocaleChange} />
      <section aria-label={copy.operationalMap} className="console-workspace">
        <FilterRail locale={locale} scenario={scenario} />
        <FleetMap locale={locale} scenario={scenario} />
        {drawerOpen && selectedVehicle !== undefined && <VehicleDrawer isFollowing={isFollowing} key={selectedVehicle.internalId} locale={locale} onClose={() => useUiCoordinationStore.getState().closeDrawer()} onRestoreFollow={() => useUiCoordinationStore.getState().restoreFollow()} onScenarioChange={onScenarioChange} operations={operations} scenario={scenario} vehicle={selectedVehicle} />}
      </section>
    </main>
  );
}
