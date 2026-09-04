import { CheckCircle, ClockCountdown, Coffee, ShieldCheck, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { OperatingRegion, Vehicle } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { REST_OPPORTUNITY_VEHICLE_ID, type RestOpportunityOption } from "../../domain/operations/restOpportunities";
import type { Locale } from "../../preferences/i18n/catalog";
import "./restOpportunityPanel.css";

type RestOpportunityPanelProps = {
  locale: Locale;
  operations: OperationsApi;
  vehicle: Vehicle;
  onScenarioChange(scenario: OperatingRegion): void;
};

const copy = {
  en: {
    heading: "Driver rest opportunity",
    intro: "Use verified delivery slack to give the driver more rest. Mandatory rest is never reduced or split.",
    compare: "Compare extra rest",
    currentEta: "Current ETA",
    commitment: "Delivery commitment",
    tolerance: "Allowed delay",
    extraRest: "Extra rest",
    access: "Access time",
    arrival: "Projected arrival",
    contractDelay: "Contract delay",
    margin: "Delivery margin",
    schedule: "Schedule rest",
    clear: "Clear scheduled rest",
    recommended: "Recommended",
    feasible: "Feasible",
    rejected: "Rejected",
    humanOnly: "Human schedules",
    scheduled: "Rest scheduled",
    verified: "Plan verified",
    routeUnchanged: "The stop lies on the existing verified route; route geometry remains unchanged.",
    notMandatory: "Additional wellbeing rest; it is not claimed as a statutory break.",
    reason: {
      DELIVERY_TOLERANCE_EXCEEDED: "Exceeds the accepted delivery tolerance.",
      DRIVE_WINDOW_EXCEEDED: "Would exceed remaining drive time.",
      REST_DEADLINE_MISSED: "The stop would begin after the rest deadline.",
      STOP_ALREADY_PASSED: "The vehicle has already passed this stop.",
      REST_OPPORTUNITY_FEASIBLE: "All hard timing constraints pass.",
    },
  },
  es: {
    heading: "Oportunidad de descanso",
    intro: "Usa la holgura verificada de entrega para que el conductor descanse más. El descanso obligatorio nunca se reduce ni se fragmenta.",
    compare: "Comparar descanso adicional",
    currentEta: "ETA actual",
    commitment: "Compromiso de entrega",
    tolerance: "Retraso permitido",
    extraRest: "Descanso adicional",
    access: "Tiempo de acceso",
    arrival: "Llegada prevista",
    contractDelay: "Retraso contractual",
    margin: "Margen de entrega",
    schedule: "Programar descanso",
    clear: "Quitar descanso programado",
    recommended: "Recomendada",
    feasible: "Viable",
    rejected: "Descartada",
    humanOnly: "Lo programa una persona",
    scheduled: "Descanso programado",
    verified: "Plan verificado",
    routeUnchanged: "La parada está sobre la ruta verificada existente; la geometría de la ruta no cambia.",
    notMandatory: "Es descanso adicional de bienestar; no se presenta como pausa reglamentaria.",
    reason: {
      DELIVERY_TOLERANCE_EXCEEDED: "Supera la tolerancia de entrega aceptada.",
      DRIVE_WINDOW_EXCEEDED: "Superaría el tiempo restante de conducción.",
      REST_DEADLINE_MISSED: "La parada comenzaría después del límite de descanso.",
      STOP_ALREADY_PASSED: "El vehículo ya ha superado esta parada.",
      REST_OPPORTUNITY_FEASIBLE: "Cumple todas las restricciones temporales estrictas.",
    },
  },
} as const;

function formatTime(value: string, locale: Locale): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date)
    : value;
}

function minutes(value: number, locale: Locale): string {
  return `${Math.round(value)} ${locale === "es" ? "min" : "min"}`;
}

function OpportunityCard({ locale, option, onSchedule }: { locale: Locale; option: RestOpportunityOption; onSchedule(option: RestOpportunityOption): void }) {
  const text = copy[locale];
  return (
    <article className={`rest-opportunity-card ${option.feasible ? "is-feasible" : "is-rejected"} ${option.recommended ? "is-recommended" : ""}`} data-rest-opportunity={option.id} data-status={option.feasible ? "feasible" : "rejected"}>
      <header>
        <div>
          <strong>{option.stopName}</strong>
          <span>{option.recommended ? text.recommended : option.feasible ? text.feasible : text.rejected}</span>
        </div>
        {option.recommended && <CheckCircle aria-hidden="true" size={22} weight="fill" />}
      </header>
      <dl>
        <div><dt>{text.extraRest}</dt><dd>{minutes(option.extraRestMinutes, locale)}</dd></div>
        <div><dt>{text.access}</dt><dd>{minutes(option.accessMinutes, locale)}</dd></div>
        <div><dt>{text.arrival}</dt><dd>{formatTime(option.projectedArrivalAt, locale)} UTC</dd></div>
        <div><dt>{text.contractDelay}</dt><dd>{minutes(option.contractualDelayMinutes, locale)}</dd></div>
        <div><dt>{text.margin}</dt><dd>{minutes(option.deliveryMarginMinutes, locale)}</dd></div>
      </dl>
      <p className="rest-opportunity-reason">{text.reason[option.reasonCode]}</p>
      {option.feasible && (
        <button aria-label={`${text.schedule}: ${option.stopName}`} className="rest-schedule-button" onClick={() => onSchedule(option)} type="button">
          <Coffee aria-hidden="true" size={17} /> {text.schedule} · {option.extraRestMinutes} min
        </button>
      )}
    </article>
  );
}

export function RestOpportunityPanel({ locale, operations, vehicle, onScenarioChange }: RestOpportunityPanelProps) {
  const [expanded, setExpanded] = useState(vehicle.scheduledRest != null);
  const [error, setError] = useState("");
  const result = useMemo(() => operations.restOpportunitiesCompare(vehicle.internalId), [operations, vehicle]);
  if (vehicle.internalId !== REST_OPPORTUNITY_VEHICLE_ID || !result.ok) return null;
  const comparison = result.data;
  const text = copy[locale];

  function refresh(): void {
    const scenario = operations.scenarioCurrent();
    if (scenario.ok) onScenarioChange(scenario.data);
  }

  function schedule(option: RestOpportunityOption): void {
    setError("");
    const scheduled = operations.restOpportunitySchedule({ vehicleId: vehicle.internalId, opportunityId: option.id });
    if (!scheduled.ok) {
      setError(scheduled.error.message);
      return;
    }
    setExpanded(true);
    refresh();
  }

  function clear(): void {
    setError("");
    const cleared = operations.restOpportunityClear(vehicle.internalId);
    if (!cleared.ok) {
      setError(cleared.error.message);
      return;
    }
    refresh();
  }

  return (
    <section aria-labelledby="rest-opportunity-heading" className="rest-opportunity-panel">
      <header className="rest-opportunity-heading">
        <div>
          <span className="rest-opportunity-kicker"><ShieldCheck aria-hidden="true" size={15} /> {text.humanOnly}</span>
          <h2 id="rest-opportunity-heading">{text.heading}</h2>
        </div>
        <ClockCountdown aria-hidden="true" size={24} />
      </header>
      <p>{text.intro}</p>

      {comparison.scheduledRest != null && (
        <div className="rest-scheduled-banner" data-rest-scheduled={comparison.scheduledRest.opportunityId}>
          <div>
            <strong><CheckCircle aria-hidden="true" size={18} weight="fill" /> {text.scheduled}: {comparison.scheduledRest.extraRestMinutes} min</strong>
            <span>{comparison.scheduledRest.stopName} · {formatTime(comparison.scheduledRest.projectedArrivalAt, locale)} UTC</span>
            {comparison.verification?.status === "PASS" && <small>{text.verified} · 7/7 PASS</small>}
          </div>
          <button aria-label={text.clear} onClick={clear} type="button"><X aria-hidden="true" size={16} /> {text.clear}</button>
        </div>
      )}

      {!expanded ? (
        <button className="rest-compare-button" onClick={() => setExpanded(true)} type="button">
          <ClockCountdown aria-hidden="true" size={18} /> {text.compare}
        </button>
      ) : (
        <>
          <dl className="rest-comparison-summary">
            <div><dt>{text.currentEta}</dt><dd>{formatTime(comparison.currentEta, locale)} UTC</dd></div>
            <div><dt>{text.commitment}</dt><dd>{formatTime(comparison.committedDeliveryAt, locale)} UTC</dd></div>
            <div><dt>{text.tolerance}</dt><dd>{comparison.maxContractDelayMinutes} min</dd></div>
          </dl>
          <div className="rest-opportunity-list">
            {comparison.options.map((option) => <OpportunityCard key={option.id} locale={locale} onSchedule={schedule} option={option} />)}
          </div>
          <p className="rest-opportunity-footnote">{text.routeUnchanged}</p>
          <p className="rest-opportunity-footnote">{text.notMandatory}</p>
        </>
      )}
      {error !== "" && <p className="rest-opportunity-error" role="alert">{error}</p>}
    </section>
  );
}
