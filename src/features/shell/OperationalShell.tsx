import type { MouseEvent } from "react";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { FilterRail } from "../fleet/FilterRail";
import { VehicleDrawer } from "../fleet/VehicleDrawer";
import { FleetMap } from "../map/FleetMap";
import { ContextPanel } from "./ContextPanel";
import { Topbar } from "./Topbar";

type OperationalShellProps = {
  locale: Locale;
  onLocaleChange(locale: Locale): void;
  onScenarioChange(scenario: OperatingRegion): void;
  operations: OperationsApi;
  scenario: OperatingRegion;
};

export function OperationalShell({ locale, onLocaleChange, onScenarioChange, operations, scenario }: OperationalShellProps) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const follow = useUiCoordinationStore((state) => state.follow);
  const panelContext = useUiCoordinationStore((state) => state.panelContext);
  const railState = useUiCoordinationStore((state) => state.railState);
  const selection = useUiCoordinationStore((state) => state.selection);
  const selectedVehicle = selection.kind === "vehicle" ? scenario.vehicles.find((vehicle) => vehicle.internalId === selection.vehicleId) : undefined;
  const copy = catalog(locale);

  function focusMap(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    document.getElementById("operational-map")?.focus();
  }

  function closeInspection(): void {
    const returnFocusId = useUiCoordinationStore.getState().closeSelection();
    requestAnimationFrame(() => document.getElementById(returnFocusId)?.focus());
  }

  return (
    <div className="console-shell">
      <a className="skip-link" href="#operational-map" onClick={focusMap}>{copy.operationalMap}</a>
      <Topbar locale={locale} onLocaleChange={onLocaleChange} />
      <main className={`console-workspace ${railState === "expanded" ? "rail-is-expanded" : ""}`}>
        <FilterRail locale={locale} scenario={scenario} />
        <section aria-label={copy.operationalMap} className="map-workspace" id="operational-map" role="region" tabIndex={-1}>
          <FleetMap locale={locale} scenario={scenario} />
        </section>
        {selectedVehicle === undefined ? (
          <ContextPanel label={panelContext.mode === "overview" ? copy.all : copy.fleetFilters} mode={panelContext.mode}>
            <div className="context-panel-header">
              <h1>{panelContext.mode === "overview" ? copy.all : copy.fleetFilters}</h1>
              {activeFilters.size > 0 && <span>{activeFilters.size}</span>}
            </div>
          </ContextPanel>
        ) : (
          <VehicleDrawer isFollowing={follow.kind === "vehicle" && follow.vehicleId === selectedVehicle.internalId} key={selectedVehicle.internalId} locale={locale} onClose={closeInspection} onRestoreFollow={() => useUiCoordinationStore.getState().restoreFollow()} onScenarioChange={onScenarioChange} operations={operations} scenario={scenario} vehicle={selectedVehicle} />
        )}
      </main>
    </div>
  );
}
