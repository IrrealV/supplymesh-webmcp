import { canonicalSerialize, createPlanFingerprint } from "../../domain/recovery/fingerprint";
import {
  validateCargoContinuity,
  validateClearancePolicy,
  validateGeometryAvoidance,
  validateRestWindow,
} from "../../domain/recovery/policies";
import { planFingerprintPayload } from "../../domain/recovery/transitions";
import type {
  OperationalRecoverySnapshot,
  VerificationCheck,
  VerificationCheckName,
  VerificationReport,
} from "../../domain/recovery/types";
import { readClearanceAlternativeRuntime } from "./clearanceAlternativeAdapter";

function verificationCheck(
  name: VerificationCheckName,
  isPassing: boolean,
  passReasonCode: string,
  failReasonCode: string,
): VerificationCheck {
  return {
    name,
    reasonCode: isPassing ? passReasonCode : failReasonCode,
    status: isPassing ? "PASS" : "FAIL",
  };
}

export function verifyUnit211Recovery(
  snapshot: OperationalRecoverySnapshot,
  baseline: OperationalRecoverySnapshot,
): VerificationReport {
  const plan = snapshot.plan;
  const approval = snapshot.approval;
  const receipt = snapshot.receipt;
  if (plan === undefined || approval === undefined || receipt === undefined) {
    throw new Error("Executed recovery authority is incomplete.");
  }

  const runtime = readClearanceAlternativeRuntime();
  const vehicle = snapshot.scenario.vehicles.find(
    ({ internalId }) => internalId === receipt.vehicleId,
  );
  const activeRoutes = snapshot.scenario.routes.filter(
    ({ vehicleId }) => vehicleId === receipt.vehicleId,
  );
  const activeRoute = activeRoutes[0];
  const baselineVehicle = baseline.scenario.vehicles.find(
    ({ internalId }) => internalId === receipt.vehicleId,
  );
  const routeBindingPasses = vehicle !== undefined
    && activeRoute !== undefined
    && vehicle.routeId === approval.proposedRouteId
    && activeRoute.id === approval.proposedRouteId
    && activeRoute.id === receipt.appliedRouteId
    && receipt.appliedRouteId === approval.proposedRouteId
    && activeRoute.riskSnaps.length === 0
    && canonicalSerialize(activeRoute.geometry) === canonicalSerialize(runtime.geometry)
    && canonicalSerialize(activeRoute.summary) === canonicalSerialize(runtime.summary);
  const geometry = activeRoute === undefined
    ? { status: "FAIL" as const }
    : validateGeometryAvoidance(
      activeRoute.geometry,
      snapshot.incident.exclusionZone,
      runtime.minimumSeparationMeters,
    );
  const clearance = vehicle === undefined
    ? { status: "FAIL" as const }
    : validateClearancePolicy({
      availableClearanceMeters: snapshot.incident.availableClearanceMeters,
      clearanceBufferMeters: snapshot.constraints.clearanceBufferMeters.value,
      isRestrictionApplicable: false,
      vehicleHeightMeters: vehicle.dimensions.heightMeters,
    });
  const restWindow = vehicle === undefined || activeRoute === undefined
    ? { status: "FAIL" as const }
    : validateRestWindow({
      currentProgress: vehicle.routeProgress,
      protectRestDeadline: snapshot.constraints.protectRestDeadline.value,
      remainingDriveMinutes: vehicle.timing.remainingDriveMinutes,
      reserveMinutes: 0,
      restDeadline: vehicle.timing.restDeadline,
      routeDurationSeconds: activeRoute.summary.durationSeconds,
      scenarioClock: snapshot.scenarioClock,
    });
  const cargoContinuity = vehicle === undefined || baselineVehicle === undefined
    ? { status: "FAIL" as const }
    : validateCargoContinuity(
      {
        cargo: baselineVehicle.cargo,
        destinationId: baselineVehicle.destination.name,
        vehicleId: baselineVehicle.internalId,
      },
      {
        cargo: vehicle.cargo,
        destinationId: vehicle.destination.name,
        vehicleId: vehicle.internalId,
      },
    );
  const fingerprint = createPlanFingerprint(planFingerprintPayload(plan));
  const receiptAuthorityPasses =
    receipt.receiptId === `operation-receipt-${plan.id}`
    && receipt.planId === plan.id
    && receipt.incidentId === plan.incidentId
    && receipt.vehicleId === plan.vehicleId
    && receipt.previousRouteId === plan.currentRouteId
    && receipt.appliedRouteId === plan.proposedRouteId
    && receipt.approvalSource === approval.approvedBy
    && receipt.approvalFingerprint === approval.fingerprint
    && receipt.beforeRevision === approval.scenarioRevision
    && receipt.afterRevision === snapshot.scenarioRevision
    && canonicalSerialize(receipt.constraints) === canonicalSerialize(plan.constraints)
    && canonicalSerialize(receipt.constraints) === canonicalSerialize(approval.constraints)
    && canonicalSerialize(receipt.constraints) === canonicalSerialize(snapshot.constraints);
  const fingerprintPasses = fingerprint === plan.fingerprint
    && fingerprint === approval.fingerprint
    && fingerprint === receipt.approvalFingerprint
    && plan.basedOnScenarioRevision === approval.scenarioRevision
    && plan.status === "EXECUTED"
    && approval.used
    && receiptAuthorityPasses;
  const executionEvents = snapshot.auditTimeline.filter(
    ({ action }) => action === "RECOVERY_PLAN_EXECUTED",
  );
  const receiptAuditReferencesPass = receipt.auditEventIds.every((eventId) =>
    snapshot.auditTimeline.some(({ id }) => id === eventId)
  ) && executionEvents.every(({ id }) => receipt.auditEventIds.includes(id));
  const singleEffectPasses = snapshot.routeEffectCount === 1
    && activeRoutes.length === 1
    && routeBindingPasses
    && receiptAuthorityPasses
    && receipt.executedOnce
    && executionEvents.length === 1
    && receiptAuditReferencesPass;
  const incidentResolutionPasses = snapshot.incident.status === "RESOLVED"
    && snapshot.incident.id === receipt.incidentId;

  const checks: VerificationCheck[] = [
    verificationCheck(
      "clearance",
      routeBindingPasses && geometry.status === "PASS" && clearance.status === "PASS",
      "CLEARANCE_VERIFIED",
      "CLEARANCE_VERIFICATION_FAILED",
    ),
    verificationCheck(
      "restWindow",
      restWindow.status === "PASS",
      "REST_WINDOW_VERIFIED",
      "REST_WINDOW_VERIFICATION_FAILED",
    ),
    verificationCheck(
      "cargoContinuity",
      cargoContinuity.status === "PASS",
      "CARGO_CONTINUITY_VERIFIED",
      "CARGO_CONTINUITY_VERIFICATION_FAILED",
    ),
    verificationCheck(
      "approvedFingerprint",
      fingerprintPasses,
      "APPROVED_FINGERPRINT_VERIFIED",
      "APPROVED_FINGERPRINT_VERIFICATION_FAILED",
    ),
    verificationCheck(
      "noDuplicateApplication",
      singleEffectPasses,
      "SINGLE_ROUTE_EFFECT_VERIFIED",
      "DUPLICATE_ROUTE_EFFECT_DETECTED",
    ),
    verificationCheck(
      "incidentResolved",
      incidentResolutionPasses,
      "INCIDENT_RESOLUTION_VERIFIED",
      "INCIDENT_RESOLUTION_VERIFICATION_FAILED",
    ),
  ];

  return {
    checks,
    expectedScenarioRevision: receipt.afterRevision,
    id: `verification-${plan.id}`,
    overall: checks.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
    planId: plan.id,
    verifiedAt: snapshot.scenarioClock.instant,
  };
}
