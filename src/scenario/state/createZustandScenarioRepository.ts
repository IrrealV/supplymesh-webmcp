import { createStore } from "zustand/vanilla";
import type { OperatingRegion, Route, Vehicle } from "../../domain/entities";
import { deepDetachAndFreeze } from "../../domain/deepDetach";
import type { OperationalRecoveryRepository, SemanticScenarioMutation } from "../../domain/ports/OperationalRecoveryRepository";
import type { ScenarioRepository } from "../../domain/ports/ScenarioRepository";
import { browserSha256Crypto, canonicalJson, sha256Fingerprint, type Sha256Crypto } from "../../domain/recovery/canonicalJson";
import {
  RecoveryErrorCodes,
  RecoveryWorkflowStatuses,
  recoveryFailure,
  recoverySuccess,
  type ApprovalGrant,
  type AdmittedRecoveryRoute,
  type RecoveryExecutionEffect,
  type RecoveryExecutionOutcome,
  type RecoveryExecutionRecord,
  type RecoveryReceipt,
  type RecoveryRouteEvidencePayload,
  type RecoveryVerificationCheck,
  type RecoveryVerificationReport,
  RecoveryVerificationCheckNames,
  type OperationalRecoverySnapshot,
  type RecoveryPlan,
  type RecoveryResult,
} from "../../domain/recovery/recoveryContracts";
import { isOperationalRecoverySnapshot, recoveryPlansEqual, validateAndNormalizeRecoveryPlan } from "../../domain/recovery/recoveryValidation";
import { readAdmittedRecoveryRoute, recoveryRouteDigest } from "../../domain/recovery/recoveryRouteAdmission";
import { createSpainScenario } from "../fixtures/spain-v1";
import { clearanceAlternativeCatalog } from "../fixtures/clearanceAlternativeCatalog";
import { browserStorage, loadScenarioOverrides, saveScenarioOverrides, type ScenarioOverrides, type StorageLike } from "../persistence/overrideStorage";
import { geoLine, geoPoint } from "../geometry";

type ScenarioState = { scenario: OperatingRegion; overrides: ScenarioOverrides; operational: OperationalRecoverySnapshot };
export type ZustandScenarioRepository = ScenarioRepository & OperationalRecoveryRepository;

const initialOperationalSnapshot: OperationalRecoverySnapshot = {
  scenarioRevision: 1,
  workflowStatus: RecoveryWorkflowStatuses.idle,
  incident: {
    id: "incident-route-011-restriction-height-3.9",
    vehicleId: "vehicle-011",
    riskId: "restriction-height-3.9",
    routeId: "route-011",
    status: "OPEN",
  },
  plan: null,
  approvalGrant: null,
  executionRecord: null,
  executionEffects: [],
  verificationReport: null,
  receipt: null,
};

function appliedRoute(route: AdmittedRecoveryRoute): Route {
  return {
    id: route.relation.alternativeRouteId,
    vehicleId: "vehicle-011",
    name: "Toledo to Alcobendas",
    geometry: geoLine(...route.geometry.coordinates),
    summary: { ...route.summary },
    riskSnaps: [],
  };
}

function detached<T>(value: T): T {
  const result = deepDetachAndFreeze(value);
  if (!result.ok) throw new TypeError("Cannot detach malformed repository data.");
  return result.data;
}

function exact(left: unknown, right: unknown): boolean {
  const leftCanonical = canonicalJson(left);
  const rightCanonical = canonicalJson(right);
  return leftCanonical.ok && rightCanonical.ok && leftCanonical.data === rightCanonical.data;
}

function check(name: RecoveryVerificationCheck["name"], passes: boolean): RecoveryVerificationCheck {
  return { name, status: passes ? "PASS" : "FAIL" };
}

function verificationArtifacts(snapshot: OperationalRecoverySnapshot, scenario: OperatingRegion, admitted: RecoveryRouteEvidencePayload, fingerprintMatches: boolean, routeDigestMatches: boolean): { report: RecoveryVerificationReport; receipt: RecoveryReceipt | null } | false {
  const plan = snapshot.plan;
  const execution = snapshot.executionRecord;
  if (plan === null || execution === null) return false;
  const units = scenario.vehicles.filter((vehicle) => vehicle.internalId === "vehicle-011");
  const routes = scenario.routes.filter((route) => route.vehicleId === "vehicle-011");
  const alternatives = routes.filter((route) => route.id === admitted.relation.alternativeRouteId);
  const unit = units[0];
  const route = alternatives[0];
  const cargoFacts = plan.constraintResults.proposedCargoContinuity.status === "PASS" ? plan.constraintResults.proposedCargoContinuity.referenceFacts : false;
  const proposedTemporal = plan.constraintResults.proposedTemporal;
  const checks: RecoveryVerificationCheck[] = [
    check("UNIT_ROUTE_SINGLETON", units.length === 1 && routes.length === 1 && alternatives.length === 1),
    check("ACTIVE_ROUTE_BINDING", unit !== undefined && unit.routeId === admitted.relation.alternativeRouteId && unit.routeProgress === 0 && exact(unit.position.geometry, { type: "Point", coordinates: admitted.geometry.coordinates[0] })),
    check("PREVIOUS_ROUTE_ABSENT", scenario.routes.every((candidate) => candidate.id !== "route-011")),
    check("CATALOG_GEOMETRY", route !== undefined && exact(route.geometry.geometry, admitted.geometry)),
    check("CATALOG_SUMMARY", route !== undefined && exact(route.summary, admitted.summary)),
    check("EXCLUSION_CLEARANCE", admitted.avoidsExclusionZone && admitted.relation.avoidsRiskId === "restriction-height-3.9" && admitted.provenance.avoidance.minimumClearanceMeters > 0),
    check("HARD_CLEARANCE_BOUND", plan.hardConstraints.clearanceBufferMeters === 0.2 && plan.constraintResults.proposedClearance.status === "PASS" && plan.constraintResults.proposedClearance.minimumClearanceMeters === admitted.provenance.avoidance.minimumClearanceMeters),
    check("TEMPORAL_PASS", admitted.temporalAssessment.status === "PASS" && proposedTemporal.status === "PASS" && exact(admitted.temporalAssessment, proposedTemporal) && unit !== undefined && unit.timing.remainingDriveMinutes === proposedTemporal.remainingDriveMinutes && unit.timing.restDeadline === proposedTemporal.restDeadline),
    check("CARGO_CONTINUITY", cargoFacts !== false && unit !== undefined && unit.cargo.id === cargoFacts.cargoId && unit.destination.id === cargoFacts.destinationId && unit.cargo.refrigeration === cargoFacts.refrigeration && unit.cargo.priority === cargoFacts.priority),
    check("PLAN_FINGERPRINT", fingerprintMatches),
    check("GRANT_CONSUMED", snapshot.approvalGrant?.used === true && snapshot.approvalGrant.planId === plan.planId && snapshot.approvalGrant.fingerprint === plan.fingerprint),
    check("SINGLE_EXECUTION_EFFECT", snapshot.executionEffects.length === 1 && snapshot.executionEffects[0].executionId === execution.executionId && snapshot.executionEffects[0].planId === plan.planId),
    check("INCIDENT_RESOLVED", snapshot.incident.status === "RESOLVED"),
    check("REVISION_INCREMENTED", execution.beforeRevision === plan.basedOnScenarioRevision && execution.afterRevision === execution.beforeRevision + 1 && snapshot.scenarioRevision === execution.afterRevision),
    check("ROUTE_DIGEST", routeDigestMatches),
  ];
  if (!exact(checks.map(({ name }) => name), RecoveryVerificationCheckNames)) return false;
  const status = checks.every((candidate) => candidate.status === "PASS") ? "PASS" : "FAIL";
  const report: RecoveryVerificationReport = { verificationId: `recovery-verification:${execution.executionId}`, executionId: execution.executionId, planId: plan.planId, fingerprint: plan.fingerprint, status, checks, createdAt: execution.createdAt };
  if (status === "FAIL") return { report, receipt: null };
  return { report, receipt: { receiptId: `recovery-receipt:${execution.executionId}`, planId: plan.planId, fingerprint: plan.fingerprint, approvalSource: execution.approvalSource, approvedAt: execution.approvedAt, beforeRevision: execution.beforeRevision, afterRevision: execution.afterRevision, previousRouteId: execution.previousRouteId, appliedRouteId: execution.appliedRouteId, executionId: execution.executionId, verificationReport: detached(report), createdAt: execution.createdAt } };
}

function applyRecoveryRoute(scenario: OperatingRegion, route: AdmittedRecoveryRoute): OperatingRegion {
  const replacement = appliedRoute(route);
  return {
    ...scenario,
    vehicles: scenario.vehicles.map((vehicle) => vehicle.internalId === "vehicle-011" ? { ...vehicle, routeId: replacement.id, routeProgress: 0, position: geoPoint(route.geometry.coordinates[0]) } : vehicle),
    routes: [...scenario.routes.filter((candidate) => candidate.vehicleId !== "vehicle-011" && candidate.id !== "route-011" && candidate.id !== replacement.id), replacement],
  };
}

function applyOverrides(overrides: ScenarioOverrides, route?: AdmittedRecoveryRoute): OperatingRegion {
  const fixture = createSpainScenario();
  const deleted = new Set(overrides.deletedVehicleIds);
  const mapVehicleOverrides = (vehicle: Vehicle) => {
    const updated = overrides.updatedVehicles?.[vehicle.internalId] || {};
    const assignedRoute = overrides.assignedRoutes?.[vehicle.internalId];
    const routeId = assignedRoute !== undefined ? (assignedRoute || "") : vehicle.routeId;
    const status = assignedRoute === null || (assignedRoute === undefined && !vehicle.routeId)
      ? "resting"
      : (assignedRoute ? "driving" : (updated.status || vehicle.status));
    return {
      ...vehicle,
      ...updated,
      label: overrides.labels[vehicle.internalId] ?? updated.label ?? vehicle.label,
      routeId,
      status: status as Vehicle["status"],
    };
  };

  const baseVehicles = fixture.vehicles
    .filter((vehicle) => !deleted.has(vehicle.internalId))
    .map(mapVehicleOverrides);

  const createdVehicles = (overrides.createdVehicles || [])
    .filter((v) => !deleted.has(v.internalId))
    .map(mapVehicleOverrides);

  const allVehicles = [...baseVehicles, ...createdVehicles];
  
  const scenario = {
    ...fixture,
    vehicles: allVehicles,
    routes: fixture.routes
      .filter((candidate) => !deleted.has(candidate.vehicleId))
      .map((candidate) => {
        const owningVehicle = allVehicles.find((v) => v.routeId === candidate.id);
        return {
          ...candidate,
          vehicleId: owningVehicle ? owningVehicle.internalId : "",
        };
      }),
  };
  return overrides.recoveryRouteApplied === true && route !== undefined ? applyRecoveryRoute(scenario, route) : scenario;
}

function findVehicle(scenario: OperatingRegion, vehicleId: string): Vehicle | undefined {
  return scenario.vehicles.find((vehicle) => vehicle.internalId === vehicleId);
}

function detachedSnapshot(snapshot: OperationalRecoverySnapshot): OperationalRecoverySnapshot {
  return detached(snapshot);
}

function repositoryFailure<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.repositoryFailure, "The operational recovery repository could not complete the transition.", ["RETRY", "CONTACT_OPERATOR"]);
}

function revisionMismatch<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.revisionMismatch, "The scenario changed before the recovery transition could commit.", ["COMPARE_OPTIONS", "STAGE_PLAN"]);
}

function invalidWorkflow<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.invalidWorkflowState, "The recovery workflow is not in a valid state for this transition.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
}

function planMismatch<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.planMismatch, "The requested plan does not match the active recovery plan.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
}

function isActive(snapshot: OperationalRecoverySnapshot): boolean {
  return snapshot.workflowStatus === RecoveryWorkflowStatuses.staged
    || snapshot.workflowStatus === RecoveryWorkflowStatuses.reviewRequested
    || snapshot.workflowStatus === RecoveryWorkflowStatuses.approved;
}

function invalidatedAfterMutation(snapshot: OperationalRecoverySnapshot): OperationalRecoverySnapshot {
  return {
    ...snapshot,
    scenarioRevision: snapshot.scenarioRevision + 1,
    workflowStatus: isActive(snapshot) ? RecoveryWorkflowStatuses.invalidated : snapshot.workflowStatus,
    approvalGrant: isActive(snapshot) ? null : snapshot.approvalGrant,
  };
}

type StageDisposition = "STAGE" | "IDEMPOTENT";

function stageDisposition(snapshot: OperationalRecoverySnapshot, expectedScenarioRevision: number, plan: RecoveryPlan): RecoveryResult<StageDisposition> {
  if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
  if (isActive(snapshot)) return recoveryPlansEqual(snapshot.plan, plan) ? recoverySuccess("IDEMPOTENT") : planMismatch();
  if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.idle && snapshot.workflowStatus !== RecoveryWorkflowStatuses.rejected && snapshot.workflowStatus !== RecoveryWorkflowStatuses.invalidated) return invalidWorkflow();
  return recoverySuccess("STAGE");
}

export function createZustandScenarioRepository(storage: StorageLike = browserStorage(), cryptoCapability: Sha256Crypto | null | undefined = browserSha256Crypto(), admittedRouteSource: unknown = clearanceAlternativeCatalog): ZustandScenarioRepository {
  const admitted = readAdmittedRecoveryRoute(() => admittedRouteSource);
  const authority = admitted.ok ? deepDetachAndFreeze(admitted.data) : { ok: false } as const;
  const admittedRoute = authority.ok ? authority.data : null;
  const overrides = loadScenarioOverrides(storage);
  const loadedOperational = overrides.operationalSnapshot ?? initialOperationalSnapshot;
  const store = createStore<ScenarioState>()(() => ({ overrides, scenario: applyOverrides(overrides, admittedRoute ?? undefined), operational: detachedSnapshot(loadedOperational) }));

  function persist(nextOverrides: ScenarioOverrides): boolean {
    if (!isOperationalRecoverySnapshot(store.getState().operational)) return false;
    if (!saveScenarioOverrides(storage, nextOverrides)) return false;
    store.setState({ overrides: nextOverrides, scenario: applyOverrides(nextOverrides, admittedRoute ?? undefined) });
    return true;
  }

  function operationalTransition(transition: (snapshot: OperationalRecoverySnapshot) => RecoveryResult<OperationalRecoverySnapshot>): RecoveryResult<OperationalRecoverySnapshot> {
    let result: RecoveryResult<OperationalRecoverySnapshot> = repositoryFailure();
    try {
      store.setState((state) => {
        if (!isOperationalRecoverySnapshot(state.operational)) {
          result = repositoryFailure();
          return state;
        }
        const candidate = transition(state.operational);
        if (!candidate.ok) {
          result = candidate;
          return state;
        }
        if (candidate.data === state.operational) {
          result = recoverySuccess(detachedSnapshot(state.operational));
          return state;
        }
        const next = detachedSnapshot(candidate.data);
        if (!isOperationalRecoverySnapshot(next)) {
          result = repositoryFailure();
          return state;
        }
        result = recoverySuccess(detachedSnapshot(next));
        return { ...state, operational: next };
      });
      return result;
    } catch {
      return repositoryFailure();
    }
  }

  return {
    scenarioCurrent: () => detached(store.getState().scenario),
    scenarioRegionSelect: (regionId: string) => {
      const nextOverrides = { ...store.getState().overrides, regionId };
      const success = persist(nextOverrides);
      return success ? detached(store.getState().scenario) : undefined;
    },
    vehicleGet: (vehicleId) => {
      const vehicle = findVehicle(store.getState().scenario, vehicleId);
      return vehicle === undefined ? undefined : detached(vehicle);
    },
    vehicleRename: (vehicleId, label) => {
      const vehicle = findVehicle(store.getState().scenario, vehicleId);
      if (vehicle === undefined) return undefined;
      const nextOverrides = { ...store.getState().overrides, labels: { ...store.getState().overrides.labels, [vehicleId]: label } };
      const renamed = persist(nextOverrides) ? findVehicle(store.getState().scenario, vehicleId) : undefined;
      return renamed === undefined ? undefined : detached(renamed);
    },
    vehicleDelete: (vehicleId) => {
      let deletedVehicle: Vehicle | undefined;
      store.setState((state) => {
        if (!isOperationalRecoverySnapshot(state.operational)) return state;
        const vehicle = findVehicle(state.scenario, vehicleId);
        if (vehicle === undefined) return state;
        const labels = { ...state.overrides.labels };
        const createdVehicles = (state.overrides.createdVehicles || []).filter((v) => v.internalId !== vehicleId);
        const baseOverrides = { ...state.overrides, labels, createdVehicles, deletedVehicleIds: [...new Set([...state.overrides.deletedVehicleIds, vehicleId])] };
        const operational = invalidatedAfterMutation(state.operational);
        const nextOverrides: ScenarioOverrides = state.overrides.recoveryRouteApplied === true ? { ...baseOverrides, operationalSnapshot: operational, recoveryRouteApplied: true } : baseOverrides;
        if (!saveScenarioOverrides(storage, nextOverrides)) return state;
        const detachedVehicle = deepDetachAndFreeze(vehicle);
        if (!detachedVehicle.ok) return state;
        deletedVehicle = detachedVehicle.data;
        return { overrides: nextOverrides, scenario: applyOverrides(nextOverrides, admittedRoute ?? undefined), operational };
      });
      return deletedVehicle === undefined ? undefined : detached(deletedVehicle);
    },
    vehicleCreate: (vehicle) => {
      let createdVehicle: Vehicle | undefined;
      store.setState((state) => {
        if (!isOperationalRecoverySnapshot(state.operational)) return state;
        const createdVehicles = [...(state.overrides.createdVehicles || []), vehicle];
        const baseOverrides = { ...state.overrides, createdVehicles };
        const operational = invalidatedAfterMutation(state.operational);
        const nextOverrides: ScenarioOverrides = state.overrides.recoveryRouteApplied === true ? { ...baseOverrides, operationalSnapshot: operational, recoveryRouteApplied: true } : baseOverrides;
        if (!saveScenarioOverrides(storage, nextOverrides)) return state;
        const detachedVehicle = deepDetachAndFreeze(vehicle);
        if (!detachedVehicle.ok) return state;
        createdVehicle = detachedVehicle.data;
        return { overrides: nextOverrides, scenario: applyOverrides(nextOverrides, admittedRoute ?? undefined), operational };
      });
      return createdVehicle ?? detached(vehicle);
    },
    vehicleUpdate: (vehicleId, updates) => {
      let updatedVehicle: Vehicle | undefined;
      store.setState((state) => {
        if (!isOperationalRecoverySnapshot(state.operational)) return state;
        const vehicle = findVehicle(state.scenario, vehicleId);
        if (vehicle === undefined) return state;
        const updatedVehicles = { ...state.overrides.updatedVehicles, [vehicleId]: { ...(state.overrides.updatedVehicles?.[vehicleId] || {}), ...updates } };
        const baseOverrides = { ...state.overrides, updatedVehicles };
        const operational = invalidatedAfterMutation(state.operational);
        const nextOverrides: ScenarioOverrides = state.overrides.recoveryRouteApplied === true ? { ...baseOverrides, operationalSnapshot: operational, recoveryRouteApplied: true } : baseOverrides;
        if (!saveScenarioOverrides(storage, nextOverrides)) return state;
        const nextScenario = applyOverrides(nextOverrides, admittedRoute ?? undefined);
        updatedVehicle = findVehicle(nextScenario, vehicleId);
        return { overrides: nextOverrides, scenario: nextScenario, operational };
      });
      return updatedVehicle === undefined ? undefined : detached(updatedVehicle);
    },
    vehicleAssignRoute: (vehicleId, routeId) => {
      let updatedVehicle: Vehicle | undefined;
      store.setState((state) => {
        if (!isOperationalRecoverySnapshot(state.operational)) return state;
        const vehicle = findVehicle(state.scenario, vehicleId);
        if (vehicle === undefined) return state;
        const assignedRoutes = { ...state.overrides.assignedRoutes, [vehicleId]: routeId ?? null };
        const baseOverrides = { ...state.overrides, assignedRoutes };
        const operational = invalidatedAfterMutation(state.operational);
        const nextOverrides: ScenarioOverrides = state.overrides.recoveryRouteApplied === true ? { ...baseOverrides, operationalSnapshot: operational, recoveryRouteApplied: true } : baseOverrides;
        if (!saveScenarioOverrides(storage, nextOverrides)) return state;
        const nextScenario = applyOverrides(nextOverrides, admittedRoute ?? undefined);
        updatedVehicle = findVehicle(nextScenario, vehicleId);
        return { overrides: nextOverrides, scenario: nextScenario, operational };
      });
      return updatedVehicle === undefined ? undefined : detached(updatedVehicle);
    },
    operationalRead: () => {
      try {
        const snapshot = store.getState().operational;
        return isOperationalRecoverySnapshot(snapshot) ? recoverySuccess(detachedSnapshot(snapshot)) : repositoryFailure();
      } catch {
        return repositoryFailure();
      }
    },
    operationalStage: async ({ expectedScenarioRevision, plan }) => {
      const validated = validateAndNormalizeRecoveryPlan(plan);
      if (validated === false || validated.plan.basedOnScenarioRevision !== expectedScenarioRevision) return planMismatch();
      let preflight: RecoveryResult<StageDisposition>;
      try {
        const snapshot = store.getState().operational;
        preflight = isOperationalRecoverySnapshot(snapshot) ? stageDisposition(snapshot, expectedScenarioRevision, validated.plan) : repositoryFailure();
      } catch {
        return repositoryFailure();
      }
      if (!preflight.ok) return preflight;
      const recomputed = await sha256Fingerprint(validated.payload, cryptoCapability);
      if (!recomputed.ok) return recomputed;
      if (recomputed.data !== validated.plan.fingerprint) return planMismatch();
      if (admittedRoute === null) return planMismatch();
      const routeDigest = await recoveryRouteDigest(admittedRoute, cryptoCapability);
      if (!routeDigest.ok) return routeDigest;
      if (routeDigest.data !== validated.plan.admittedRouteDigest) return planMismatch();
      return operationalTransition((snapshot) => {
        const disposition = stageDisposition(snapshot, expectedScenarioRevision, validated.plan);
        if (!disposition.ok) return disposition;
        if (disposition.data === "IDEMPOTENT") return recoverySuccess(snapshot);
        return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.staged, plan: detached(validated.plan), approvalGrant: null });
      });
    },
    operationalRequestReview: ({ expectedScenarioRevision, planId }) => operationalTransition((snapshot) => {
      if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (snapshot.plan === null || snapshot.plan.planId !== planId) return planMismatch();
      if (snapshot.workflowStatus === RecoveryWorkflowStatuses.reviewRequested || snapshot.workflowStatus === RecoveryWorkflowStatuses.approved) return recoverySuccess(snapshot);
      if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.staged) return invalidWorkflow();
      return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.reviewRequested });
    }),
    operationalApprove: ({ expectedScenarioRevision, planId }) => operationalTransition((snapshot) => {
      if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (snapshot.plan === null || snapshot.plan.planId !== planId) return planMismatch();
      if (snapshot.workflowStatus === RecoveryWorkflowStatuses.approved && snapshot.approvalGrant !== null) return recoverySuccess(snapshot);
      if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.reviewRequested) return invalidWorkflow();
      const approvalGrant: ApprovalGrant = {
        planId: snapshot.plan.planId,
        fingerprint: snapshot.plan.fingerprint,
        scenarioRevision: snapshot.scenarioRevision,
        approvedAt: snapshot.plan.createdAt,
        approvedBy: "human-ui",
        used: false,
      };
      return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.approved, approvalGrant });
    }),
    operationalReject: ({ expectedScenarioRevision, planId }) => operationalTransition((snapshot) => {
      if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (snapshot.plan === null || snapshot.plan.planId !== planId) return planMismatch();
      if (snapshot.workflowStatus === RecoveryWorkflowStatuses.rejected) return recoverySuccess(snapshot);
      if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.staged && snapshot.workflowStatus !== RecoveryWorkflowStatuses.reviewRequested && snapshot.workflowStatus !== RecoveryWorkflowStatuses.approved) return invalidWorkflow();
      return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.rejected, approvalGrant: null });
    }),
    operationalExecute: async ({ expectedScenarioRevision, planId }) => {
      const preflight = store.getState().operational;
      if (!isOperationalRecoverySnapshot(preflight)) return repositoryFailure();
      if (preflight.executionRecord !== null) return preflight.executionRecord.planId === planId
        ? recoverySuccess({ status: "ALREADY_EXECUTED", execution: detached(preflight.executionRecord) })
        : planMismatch();
      if (preflight.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (preflight.workflowStatus !== RecoveryWorkflowStatuses.approved || preflight.plan === null || preflight.approvalGrant === null) return invalidWorkflow();
      if (preflight.plan.planId !== planId || preflight.approvalGrant.planId !== planId || preflight.approvalGrant.fingerprint !== preflight.plan.fingerprint || preflight.approvalGrant.used || admittedRoute === null) return planMismatch();
      const validated = validateAndNormalizeRecoveryPlan(preflight.plan);
      if (validated === false) return planMismatch();
      const recomputed = await sha256Fingerprint(validated.payload, cryptoCapability);
      if (!recomputed.ok) return recomputed;
      if (recomputed.data !== validated.plan.fingerprint) return planMismatch();
      const admittedDigest = await recoveryRouteDigest(admittedRoute, cryptoCapability);
      if (!admittedDigest.ok) return admittedDigest;
      if (admittedDigest.data !== validated.plan.admittedRouteDigest) return planMismatch();
      let result: RecoveryResult<RecoveryExecutionOutcome> = repositoryFailure();
      try {
        store.setState((state) => {
          const snapshot = state.operational;
          if (!isOperationalRecoverySnapshot(snapshot)) { result = repositoryFailure(); return state; }
          if (snapshot.executionRecord !== null) {
            result = snapshot.executionRecord.planId === planId
              ? recoverySuccess({ status: "ALREADY_EXECUTED", execution: detached(snapshot.executionRecord) })
              : planMismatch();
            return state;
          }
          if (snapshot.scenarioRevision !== expectedScenarioRevision) { result = revisionMismatch(); return state; }
          if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.approved || snapshot.plan === null || snapshot.approvalGrant === null) { result = invalidWorkflow(); return state; }
          if (!recoveryPlansEqual(snapshot.plan, validated.plan) || snapshot.approvalGrant.planId !== planId || snapshot.approvalGrant.fingerprint !== snapshot.plan.fingerprint || snapshot.approvalGrant.used) { result = planMismatch(); return state; }
          if (admittedRoute.relation.alternativeRouteId !== snapshot.plan.proposedRouteId || admittedRoute.relation.currentRouteId !== snapshot.plan.currentRouteId || admittedRoute.relation.vehicleId !== snapshot.plan.vehicleId || admittedRoute.provenance.sourceRevision !== snapshot.plan.admittedRouteSourceRevision || admittedRoute.summary.distanceMeters !== snapshot.plan.metrics.proposed.distanceMeters || admittedRoute.summary.durationSeconds !== snapshot.plan.metrics.proposed.durationSeconds || admittedDigest.data !== snapshot.plan.admittedRouteDigest) { result = planMismatch(); return state; }
          const unit = state.scenario.vehicles.filter((vehicle) => vehicle.internalId === "vehicle-011");
          const currentRoutes = state.scenario.routes.filter((candidate) => candidate.id === "route-011" && candidate.vehicleId === "vehicle-011");
          if (unit.length !== 1 || unit[0].routeId !== "route-011" || currentRoutes.length !== 1) { result = planMismatch(); return state; }
          const afterRevision = snapshot.scenarioRevision + 1;
          const execution: RecoveryExecutionRecord = { executionId: `recovery-execution:${planId}`, planId, fingerprint: snapshot.plan.fingerprint, approvalSource: "human-ui", approvedAt: snapshot.approvalGrant.approvedAt, beforeRevision: snapshot.scenarioRevision, afterRevision, previousRouteId: "route-011", appliedRouteId: "alternative-route-011-clearance-v1", createdAt: snapshot.plan.createdAt };
          const effect: RecoveryExecutionEffect = { effectId: `recovery-effect:${execution.executionId}`, executionId: execution.executionId, planId, vehicleId: "vehicle-011", previousRouteId: "route-011", appliedRouteId: "alternative-route-011-clearance-v1", beforeRevision: snapshot.scenarioRevision, afterRevision };
          const nextOperational: OperationalRecoverySnapshot = { ...snapshot, scenarioRevision: afterRevision, workflowStatus: RecoveryWorkflowStatuses.executed, incident: { ...snapshot.incident, status: "RESOLVED" }, approvalGrant: { ...snapshot.approvalGrant, used: true }, executionRecord: execution, executionEffects: [effect], verificationReport: null, receipt: null };
          if (!isOperationalRecoverySnapshot(nextOperational)) { result = repositoryFailure(); return state; }
          const nextScenario = applyRecoveryRoute(state.scenario, admittedRoute);
          const nextOverrides: ScenarioOverrides = { ...state.overrides, operationalSnapshot: nextOperational, recoveryRouteApplied: true };
          if (!saveScenarioOverrides(storage, nextOverrides)) { result = repositoryFailure(); return state; }
          result = recoverySuccess({ status: "EXECUTED", execution: detached(execution) });
          return { overrides: nextOverrides, scenario: nextScenario, operational: detachedSnapshot(nextOperational) };
        });
        return result;
      } catch {
        return repositoryFailure();
      }
    },
    operationalVerificationRead: () => {
      try {
        const state = store.getState();
        return isOperationalRecoverySnapshot(state.operational) ? recoverySuccess(detached({ operational: state.operational, scenario: state.scenario })) : repositoryFailure();
      } catch {
        return repositoryFailure();
      }
    },
    operationalVerify: async ({ expectedScenarioRevision, planId }) => {
      const preflightState = store.getState();
      if (!isOperationalRecoverySnapshot(preflightState.operational)) return repositoryFailure();
      const captured = detached({ operational: preflightState.operational, scenario: preflightState.scenario });
      const preflight = captured.operational;
      if (preflight.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (preflight.plan?.planId !== planId || preflight.executionRecord?.planId !== planId || admittedRoute === null) return planMismatch();
      if (preflight.workflowStatus !== RecoveryWorkflowStatuses.executed && preflight.workflowStatus !== RecoveryWorkflowStatuses.verificationFailed && preflight.workflowStatus !== RecoveryWorkflowStatuses.verified) return invalidWorkflow();
      const validated = validateAndNormalizeRecoveryPlan(preflight.plan);
      if (validated === false) return repositoryFailure();
      const fingerprint = await sha256Fingerprint(validated.payload, cryptoCapability);
      if (!fingerprint.ok) return fingerprint;
      const admittedDigest = await recoveryRouteDigest(admittedRoute, cryptoCapability);
      if (!admittedDigest.ok) return admittedDigest;
      if (preflight.workflowStatus === RecoveryWorkflowStatuses.verified && (fingerprint.data !== preflight.plan.fingerprint || admittedDigest.data !== preflight.plan.admittedRouteDigest)) return planMismatch();
      let reportResult: RecoveryResult<RecoveryVerificationReport> = repositoryFailure();
      try {
        store.setState((state) => {
          const snapshot = state.operational;
          if (!isOperationalRecoverySnapshot(snapshot)) { reportResult = repositoryFailure(); return state; }
          if (snapshot.scenarioRevision !== expectedScenarioRevision) { reportResult = revisionMismatch(); return state; }
          if (snapshot.plan?.planId !== planId || snapshot.executionRecord?.planId !== planId) { reportResult = planMismatch(); return state; }
          if (snapshot.workflowStatus === RecoveryWorkflowStatuses.verified && snapshot.verificationReport !== null) { reportResult = recoverySuccess(detached(snapshot.verificationReport)); return state; }
          if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.executed && snapshot.workflowStatus !== RecoveryWorkflowStatuses.verificationFailed) { reportResult = invalidWorkflow(); return state; }
          if (!recoveryPlansEqual(snapshot.plan, validated.plan) || !exact(state.scenario, captured.scenario)) { reportResult = revisionMismatch(); return state; }
          const artifacts = verificationArtifacts(snapshot, state.scenario, admittedRoute, fingerprint.data === snapshot.plan.fingerprint, admittedDigest.data === snapshot.plan.admittedRouteDigest);
          if (artifacts === false) { reportResult = repositoryFailure(); return state; }
          const nextOperational: OperationalRecoverySnapshot = { ...snapshot, workflowStatus: artifacts.report.status === "PASS" ? RecoveryWorkflowStatuses.verified : RecoveryWorkflowStatuses.verificationFailed, verificationReport: detached(artifacts.report), receipt: artifacts.receipt === null ? null : detached(artifacts.receipt) };
          if (!isOperationalRecoverySnapshot(nextOperational)) { reportResult = repositoryFailure(); return state; }
          const nextOverrides: ScenarioOverrides = { ...state.overrides, operationalSnapshot: nextOperational, recoveryRouteApplied: true };
          if (!saveScenarioOverrides(storage, nextOverrides)) { reportResult = repositoryFailure(); return state; }
          reportResult = recoverySuccess(detached(artifacts.report));
          return { ...state, overrides: nextOverrides, operational: detachedSnapshot(nextOperational) };
        });
        return reportResult;
      } catch {
        return repositoryFailure();
      }
    },
    operationalReceiptGet: ({ planId }) => {
      try {
        const snapshot = store.getState().operational;
        if (!isOperationalRecoverySnapshot(snapshot)) return repositoryFailure();
        if (snapshot.plan?.planId !== planId) return planMismatch();
        return snapshot.workflowStatus === RecoveryWorkflowStatuses.verified && snapshot.receipt !== null
          ? recoverySuccess(detached(snapshot.receipt))
          : recoveryFailure(RecoveryErrorCodes.receiptUnavailable, "A verified recovery receipt is not available.", ["VERIFY_EXECUTION", "RETRY"]);
      } catch {
        return repositoryFailure();
      }
    },
    operationalReset: ({ expectedScenarioRevision }) => {
      const current = store.getState().operational;
      if (!isOperationalRecoverySnapshot(current)) return repositoryFailure();
      if (current.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (current.workflowStatus === RecoveryWorkflowStatuses.idle) return recoverySuccess(detachedSnapshot(current));
      let resetResult: RecoveryResult<OperationalRecoverySnapshot> = repositoryFailure();
      try {
        store.setState((state) => {
          if (!isOperationalRecoverySnapshot(state.operational)) { resetResult = repositoryFailure(); return state; }
          if (state.operational.scenarioRevision !== expectedScenarioRevision) { resetResult = revisionMismatch(); return state; }
          const nextOperational: OperationalRecoverySnapshot = { ...initialOperationalSnapshot, scenarioRevision: expectedScenarioRevision + 1 };
          if (!isOperationalRecoverySnapshot(nextOperational)) { resetResult = repositoryFailure(); return state; }
          const deletedVehicleIds = state.overrides.deletedVehicleIds.filter((id) => id !== "vehicle-011");
          const nextOverrides: ScenarioOverrides = { version: 1, labels: { ...state.overrides.labels }, deletedVehicleIds };
          const baseline = applyOverrides(nextOverrides);
          const route = baseline.routes.find((candidate) => candidate.id === "route-011" && candidate.vehicleId === "vehicle-011");
          const scenario = route === undefined ? baseline : { ...baseline, vehicles: baseline.vehicles.map((vehicle) => vehicle.internalId === "vehicle-011" ? { ...vehicle, routeId: "route-011", routeProgress: 0, position: geoPoint(route.geometry.geometry.coordinates[0]) } : vehicle) };
          if (!saveScenarioOverrides(storage, nextOverrides)) { resetResult = repositoryFailure(); return state; }
          resetResult = recoverySuccess(detachedSnapshot(nextOperational));
          return { overrides: nextOverrides, scenario, operational: detachedSnapshot(nextOperational) };
        });
        return resetResult;
      } catch {
        return repositoryFailure();
      }
    },
    operationalInvalidateForScenarioMutation: ({ expectedScenarioRevision, mutation }: Readonly<{ expectedScenarioRevision: number; mutation: SemanticScenarioMutation }>) => {
      void mutation;
      return operationalTransition((snapshot) => snapshot.scenarioRevision === expectedScenarioRevision ? recoverySuccess(invalidatedAfterMutation(snapshot)) : revisionMismatch());
    },
    operationalSubscribe: (listener) => store.subscribe((state, previousState) => {
      if (state.operational === previousState.operational) return;
      if (!isOperationalRecoverySnapshot(state.operational)) return;
      try {
        listener(detachedSnapshot(state.operational));
      } catch {
        // Subscriber failures cannot roll back an already committed repository transition.
      }
    }),
  };
}
