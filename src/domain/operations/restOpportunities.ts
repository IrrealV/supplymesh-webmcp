import type { DomainResult, GeoPoint, OperatingRegion, ScheduledRestPlan, Vehicle } from "../entities";
import { pointAtRouteProgress } from "../../scenario/routeRuntime";

export const REST_OPPORTUNITY_VEHICLE_ID = "vehicle-012";
export const REST_SCENARIO_CLOCK = "2026-08-28T09:00:00.000Z";
export const REST_DELIVERY_SLACK_MINUTES = 51;
export const REST_MAX_CONTRACT_DELAY_MINUTES = 10;

export type RestOpportunityReasonCode =
  | "REST_OPPORTUNITY_FEASIBLE"
  | "DELIVERY_TOLERANCE_EXCEEDED"
  | "DRIVE_WINDOW_EXCEEDED"
  | "REST_DEADLINE_MISSED"
  | "STOP_ALREADY_PASSED";

export type RestOpportunityOption = Readonly<{
  id: string;
  vehicleId: string;
  routeId: string;
  stopName: string;
  stopProgress: number;
  stopPosition: GeoPoint;
  source: "deterministic-demo";
  extraRestMinutes: number;
  accessMinutes: number;
  qualifiesAsMandatoryBreak: false;
  currentEta: string;
  projectedArrivalAt: string;
  committedDeliveryAt: string;
  etaDelayMinutes: number;
  contractualDelayMinutes: number;
  deliveryMarginMinutes: number;
  maxContractDelayMinutes: number;
  remainingRouteDriveMinutes: number;
  remainingDriveMinutes: number;
  restDeadline: string;
  stopArrivalAt: string;
  feasible: boolean;
  recommended: boolean;
  reasonCode: RestOpportunityReasonCode;
}>;

export type RestPlanVerification = Readonly<{
  status: "PASS" | "FAIL";
  checks: ReadonlyArray<Readonly<{ name: "PLAN_BOUND_TO_VEHICLE" | "ROUTE_UNCHANGED" | "STOP_MATCHES_CATALOG" | "ETA_MATCHES_PLAN" | "DELIVERY_TOLERANCE" | "DRIVE_WINDOW" | "REST_DEADLINE"; status: "PASS" | "FAIL" }>>;
}>;

export type RestOpportunityComparison = Readonly<{
  scenarioClock: string;
  vehicleId: string;
  routeId: string;
  currentEta: string;
  committedDeliveryAt: string;
  maxContractDelayMinutes: number;
  policy: Readonly<{
    objective: "MAXIMIZE_ADDITIONAL_REST";
    mandatoryRestIsNeverReduced: true;
    routeGeometryUnchanged: true;
    humanSchedulesRest: true;
  }>;
  options: readonly RestOpportunityOption[];
  recommendedOptionId: string | null;
  scheduledRest: ScheduledRestPlan | null;
  verification: RestPlanVerification | null;
}>;

type CandidateSeed = Readonly<{
  id: string;
  stopName: string;
  stopProgress: number;
  extraRestMinutes: number;
  accessMinutes: number;
}>;

const CANDIDATES: readonly CandidateSeed[] = [
  { id: "rest-window-early-40", stopName: "Corridor rest point A", stopProgress: 0.84, extraRestMinutes: 40, accessMinutes: 4 },
  { id: "rest-window-max-55", stopName: "Corridor rest point B", stopProgress: 0.90, extraRestMinutes: 55, accessMinutes: 6 },
  { id: "rest-window-late-70", stopName: "Corridor rest point C", stopProgress: 0.96, extraRestMinutes: 70, accessMinutes: 8 },
] as const;

function failure<T>(code: string, message: string): DomainResult<T> {
  return { ok: false, error: { code, message } };
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function finiteDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function roundedMinutes(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function optionFor(vehicle: Vehicle, route: OperatingRegion["routes"][number], seed: CandidateSeed): RestOpportunityOption {
  const currentEtaMs = Date.parse(vehicle.timing.eta);
  const clockMs = Date.parse(REST_SCENARIO_CLOCK);
  const committedDeliveryAt = addMinutes(vehicle.timing.eta, REST_DELIVERY_SLACK_MINUTES);
  const committedMs = Date.parse(committedDeliveryAt);
  const etaDelayMinutes = seed.extraRestMinutes + seed.accessMinutes;
  const projectedMs = currentEtaMs + etaDelayMinutes * 60_000;
  const projectedArrivalAt = new Date(projectedMs).toISOString();
  const contractualDelayMinutes = Math.max(0, Math.round((projectedMs - committedMs) / 60_000));
  const deliveryMarginMinutes = Math.max(0, Math.round((committedMs - projectedMs) / 60_000));
  const remainingRouteDriveMinutes = roundedMinutes((route.summary.durationSeconds / 60) * (1 - vehicle.routeProgress));
  const etaWindowMinutes = Math.max(0, (currentEtaMs - clockMs) / 60_000);
  const relativeProgress = Math.max(0, Math.min(1, (seed.stopProgress - vehicle.routeProgress) / Math.max(0.000001, 1 - vehicle.routeProgress)));
  const stopArrivalAt = addMinutes(REST_SCENARIO_CLOCK, etaWindowMinutes * relativeProgress + seed.accessMinutes / 2);

  let reasonCode: RestOpportunityReasonCode = "REST_OPPORTUNITY_FEASIBLE";
  if (seed.stopProgress <= vehicle.routeProgress) reasonCode = "STOP_ALREADY_PASSED";
  else if (remainingRouteDriveMinutes + seed.accessMinutes > vehicle.timing.remainingDriveMinutes) reasonCode = "DRIVE_WINDOW_EXCEEDED";
  else if (Date.parse(stopArrivalAt) > Date.parse(vehicle.timing.restDeadline)) reasonCode = "REST_DEADLINE_MISSED";
  else if (contractualDelayMinutes > REST_MAX_CONTRACT_DELAY_MINUTES) reasonCode = "DELIVERY_TOLERANCE_EXCEEDED";

  return {
    id: seed.id,
    vehicleId: vehicle.internalId,
    routeId: route.id,
    stopName: seed.stopName,
    stopProgress: seed.stopProgress,
    stopPosition: pointAtRouteProgress(route.geometry.geometry.coordinates, seed.stopProgress),
    source: "deterministic-demo",
    extraRestMinutes: seed.extraRestMinutes,
    accessMinutes: seed.accessMinutes,
    qualifiesAsMandatoryBreak: false,
    currentEta: vehicle.scheduledRest?.previousEta ?? vehicle.timing.eta,
    projectedArrivalAt,
    committedDeliveryAt,
    etaDelayMinutes,
    contractualDelayMinutes,
    deliveryMarginMinutes,
    maxContractDelayMinutes: REST_MAX_CONTRACT_DELAY_MINUTES,
    remainingRouteDriveMinutes,
    remainingDriveMinutes: vehicle.timing.remainingDriveMinutes,
    restDeadline: vehicle.timing.restDeadline,
    stopArrivalAt,
    feasible: reasonCode === "REST_OPPORTUNITY_FEASIBLE",
    recommended: false,
    reasonCode,
  };
}

function verificationFor(vehicle: Vehicle, options: readonly RestOpportunityOption[]): RestPlanVerification | null {
  const plan = vehicle.scheduledRest;
  if (plan == null) return null;
  const option = options.find((candidate) => candidate.id === plan.opportunityId);
  const checks: RestPlanVerification["checks"] = [
    { name: "PLAN_BOUND_TO_VEHICLE", status: plan.vehicleId === vehicle.internalId ? "PASS" : "FAIL" },
    { name: "ROUTE_UNCHANGED", status: plan.routeId === vehicle.routeId ? "PASS" : "FAIL" },
    { name: "STOP_MATCHES_CATALOG", status: option !== undefined && option.stopProgress === plan.stopProgress && option.stopName === plan.stopName ? "PASS" : "FAIL" },
    { name: "ETA_MATCHES_PLAN", status: vehicle.timing.eta === plan.projectedArrivalAt ? "PASS" : "FAIL" },
    { name: "DELIVERY_TOLERANCE", status: plan.contractualDelayMinutes <= plan.maxContractDelayMinutes ? "PASS" : "FAIL" },
    { name: "DRIVE_WINDOW", status: option !== undefined && option.remainingRouteDriveMinutes + option.accessMinutes <= option.remainingDriveMinutes ? "PASS" : "FAIL" },
    { name: "REST_DEADLINE", status: option !== undefined && Date.parse(option.stopArrivalAt) <= Date.parse(option.restDeadline) ? "PASS" : "FAIL" },
  ];
  return { status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL", checks };
}

export function compareRestOpportunities(scenario: OperatingRegion, vehicleId: string): DomainResult<RestOpportunityComparison> {
  const vehicle = scenario.vehicles.find((candidate) => candidate.internalId === vehicleId);
  if (vehicle === undefined) return failure("vehicle-not-found", `Vehicle ${vehicleId} was not found.`);
  if (vehicleId !== REST_OPPORTUNITY_VEHICLE_ID) return failure("rest-opportunities-unavailable", "This deterministic demo has no rest opportunity catalog for that vehicle.");
  if (!vehicle.routeId) return failure("route-not-assigned", "The vehicle has no route assigned.");
  const route = scenario.routes.find((candidate) => candidate.id === vehicle.routeId && candidate.vehicleId === vehicle.internalId);
  if (route === undefined) return failure("route-not-authoritative", "The vehicle route is unavailable or assigned to another vehicle.");
  if (!finiteDate(vehicle.timing.eta) || !finiteDate(vehicle.timing.restDeadline) || !finiteDate(REST_SCENARIO_CLOCK)) return failure("timing-invalid", "The vehicle timing data is invalid.");
  if (!Number.isFinite(vehicle.routeProgress) || vehicle.routeProgress < 0 || vehicle.routeProgress >= 1) return failure("route-progress-invalid", "The vehicle route progress is invalid.");
  if (!Number.isFinite(route.summary.durationSeconds) || route.summary.durationSeconds <= 0 || !Number.isFinite(vehicle.timing.remainingDriveMinutes) || vehicle.timing.remainingDriveMinutes < 0) return failure("timing-invalid", "The route duration or remaining drive time is invalid.");

  const baselineVehicle = vehicle.scheduledRest == null
    ? vehicle
    : { ...vehicle, timing: { ...vehicle.timing, eta: vehicle.scheduledRest.previousEta } };
  const raw = CANDIDATES.map((seed) => optionFor(baselineVehicle, route, seed));
  const recommended = raw
    .filter((option) => option.feasible)
    .sort((left, right) => right.extraRestMinutes - left.extraRestMinutes || left.contractualDelayMinutes - right.contractualDelayMinutes || left.accessMinutes - right.accessMinutes)[0];
  const options = raw.map((option) => ({ ...option, recommended: option.id === recommended?.id }));

  return {
    ok: true,
    data: {
      scenarioClock: REST_SCENARIO_CLOCK,
      vehicleId,
      routeId: route.id,
      currentEta: baselineVehicle.timing.eta,
      committedDeliveryAt: addMinutes(baselineVehicle.timing.eta, REST_DELIVERY_SLACK_MINUTES),
      maxContractDelayMinutes: REST_MAX_CONTRACT_DELAY_MINUTES,
      policy: {
        objective: "MAXIMIZE_ADDITIONAL_REST",
        mandatoryRestIsNeverReduced: true,
        routeGeometryUnchanged: true,
        humanSchedulesRest: true,
      },
      options,
      recommendedOptionId: recommended?.id ?? null,
      scheduledRest: vehicle.scheduledRest ?? null,
      verification: verificationFor(vehicle, options),
    },
  };
}

export function scheduledRestPlanFrom(option: RestOpportunityOption): ScheduledRestPlan {
  return {
    planId: `rest-plan:${option.vehicleId}:${option.id}`,
    vehicleId: option.vehicleId,
    routeId: option.routeId,
    opportunityId: option.id,
    stopName: option.stopName,
    stopPosition: option.stopPosition,
    stopProgress: option.stopProgress,
    extraRestMinutes: option.extraRestMinutes,
    accessMinutes: option.accessMinutes,
    previousEta: option.currentEta,
    projectedArrivalAt: option.projectedArrivalAt,
    committedDeliveryAt: option.committedDeliveryAt,
    contractualDelayMinutes: option.contractualDelayMinutes,
    maxContractDelayMinutes: option.maxContractDelayMinutes,
    scheduledAt: REST_SCENARIO_CLOCK,
    scheduledBy: "human-ui",
    status: "SCHEDULED",
  };
}
