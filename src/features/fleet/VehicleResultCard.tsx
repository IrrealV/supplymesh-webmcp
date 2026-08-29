import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { getVehicleDisplayName, type RiskKind } from "../../domain/entities";
import { catalog, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import type { FilterResult } from "./filtering";

function statusLabel(status: FilterResult["vehicle"]["status"], locale: Locale): string {
  const copy = catalog(locale);
  return status === "driving" ? copy.statusDriving : status === "resting" ? copy.statusResting : status === "needs-attention" ? copy.statusNeedsAttention : copy.statusCritical;
}

function riskLabel(kind: RiskKind, locale: Locale): string {
  const copy = operationalCopy(locale);
  if (kind === "severe-snow") return copy.severeWeather;
  if (kind === "road-closure") return copy.roadClosure;
  if (kind === "height-restriction") return copy.lowClearance;
  if (kind === "weight-restriction") return copy.weightRestriction;
  return copy.restDeadlineRisk;
}

export function VehicleResultCard({ locale, result }: { locale: Locale; result: FilterResult }) {
  const { vehicle } = result;
  const displayName = getVehicleDisplayName(vehicle);
  const copy = catalog(locale);
  const operationsCopy = operationalCopy(locale);
  const severity = result.severity === "critical" ? operationsCopy.severityCritical : result.severity === "high" ? operationsCopy.severityHigh : result.severity === "medium" ? operationsCopy.severityMedium : operationsCopy.severityLow;
  const eta = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(vehicle.timing.eta));
  const reasons = [...new Set(result.matchingRisks.map((risk) => riskLabel(risk.kind, locale)))];
  return <button aria-label={copy.selectVehicle.replace("{label}", displayName)} className="vehicle-result-card" id={`result-${vehicle.internalId}`} onClick={() => useUiCoordinationStore.getState().selectVehicle(vehicle.internalId, `result-${vehicle.internalId}`)} type="button">
    <span className="result-identity"><strong>{displayName}</strong>{displayName !== vehicle.fleetNumber && <small>{vehicle.fleetNumber}</small>}</span>
    <span className="result-route">{vehicle.origin.name} → {vehicle.destination.name}</span>
    <span className="result-status"><b>{statusLabel(vehicle.status, locale)}</b><i data-severity={result.severity}>{severity}</i></span>
    <span className="result-timing">{copy.eta} {eta}{vehicle.timing.delayMinutes > 0 ? ` · ${copy.delay} ${vehicle.timing.delayMinutes} ${copy.minutes}` : ""}</span>
    {reasons.length > 0 && <span className="result-reasons">{reasons.map((reason) => <em key={reason}>{reason}</em>)}</span>}
  </button>;
}
