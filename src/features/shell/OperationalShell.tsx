import type { OperatingRegion } from "../../domain/entities";
import { FilterRail } from "../fleet/FilterRail";
import { FleetMap } from "../map/FleetMap";
import { Topbar } from "./Topbar";

export function OperationalShell({ scenario }: { scenario: OperatingRegion }) {
  return (
    <main className="console-shell">
      <Topbar />
      <section aria-label="Operational map workspace" className="console-workspace">
        <FilterRail scenario={scenario} />
        <FleetMap scenario={scenario} />
      </section>
    </main>
  );
}
