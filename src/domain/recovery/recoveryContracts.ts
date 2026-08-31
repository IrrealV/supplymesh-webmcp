import type {
  Unit211CargoContinuityAssessment,
  Unit211PreDispatchData,
  Unit211RejectedClearanceAssessment,
  Unit211TemporalAssessment,
} from "../operations/unit211PreDispatchContext";

export const RecoveryWorkflowStatuses = {
  idle: "IDLE",
  staged: "STAGED",
  reviewRequested: "REVIEW_REQUESTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  invalidated: "INVALIDATED",
} as const;

export type RecoveryWorkflowStatus = (typeof RecoveryWorkflowStatuses)[keyof typeof RecoveryWorkflowStatuses];

export const RecoveryErrorCodes = {
  invalidInput: "INVALID_INPUT",
  comparisonUnavailable: "COMPARISON_UNAVAILABLE",
  optionNotAdmitted: "OPTION_NOT_ADMITTED",
  safetyEvidenceFailed: "SAFETY_EVIDENCE_FAILED",
  safetyEvidenceUnknown: "SAFETY_EVIDENCE_UNKNOWN",
  canonicalizationFailed: "CANONICALIZATION_FAILED",
  cryptoUnavailable: "CRYPTO_UNAVAILABLE",
  cryptoFailure: "CRYPTO_FAILURE",
  revisionMismatch: "REVISION_MISMATCH",
  invalidWorkflowState: "INVALID_WORKFLOW_STATE",
  planMismatch: "PLAN_MISMATCH",
  repositoryFailure: "REPOSITORY_FAILURE",
  malformedRepositoryData: "MALFORMED_REPOSITORY_DATA",
} as const;

export type RecoveryErrorCode = (typeof RecoveryErrorCodes)[keyof typeof RecoveryErrorCodes];
export type RecoveryAction = "COMPARE_OPTIONS" | "SELECT_ADMITTED_OPTION" | "STAGE_PLAN" | "REQUEST_REVIEW" | "RETRY" | "CONTACT_OPERATOR";

export type RecoveryResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: Readonly<{ code: RecoveryErrorCode; message: string; actions: readonly RecoveryAction[] }> }>;

export type RecoveryIncident = Readonly<{
  id: "incident-route-011-restriction-height-3.9";
  vehicleId: "vehicle-011";
  riskId: "restriction-height-3.9";
  routeId: "route-011";
  status: "OPEN";
}>;

export type RecoveryHardConstraints = Readonly<{
  clearanceBufferMeters: 0.2;
  protectRestDeadline: true;
  keepCargoAssignment: true;
  requireExclusionZoneAvoidance: true;
}>;

export type RecoveryClearanceResult = Readonly<{
  status: "PASS" | "FAIL" | "UNKNOWN";
  reasonCode: "MINIMUM_CLEARANCE_SATISFIED" | "MINIMUM_CLEARANCE_VIOLATION" | "CLEARANCE_EVIDENCE_INVALID";
  clearanceBufferMeters: number;
  minimumClearanceMeters: number | null;
}>;

export type RecoveryAvoidanceResult = Readonly<{
  status: "PASS" | "FAIL" | "UNKNOWN";
  reasonCode: "EXCLUSION_ZONE_AVOIDED" | "EXCLUSION_ZONE_NOT_AVOIDED" | "AVOIDANCE_EVIDENCE_INVALID";
  avoidsExclusionZone: boolean | null;
  avoidsRiskId: string;
}>;

export type RecoveryConstraintResults = Readonly<{
  currentClearance: Unit211RejectedClearanceAssessment;
  proposedClearance: RecoveryClearanceResult;
  proposedAvoidance: RecoveryAvoidanceResult;
  proposedTemporal: Unit211TemporalAssessment;
  proposedCargoContinuity: Unit211CargoContinuityAssessment;
}>;

export type RecoveryRouteMetrics = Readonly<{
  distanceMeters: number;
  durationSeconds: number;
  remainingRouteMinutes: number | null;
  estimatedCompletionAt: string | null;
}>;

export type RecoveryPlanPayload = Readonly<{
  planId: string;
  basedOnScenarioRevision: number;
  selectedOptionId: string;
  vehicleId: string;
  incidentId: string;
  currentRouteId: string;
  proposedRouteId: string;
  hardConstraints: RecoveryHardConstraints;
  constraintResults: RecoveryConstraintResults;
  metrics: Readonly<{ current: RecoveryRouteMetrics; proposed: RecoveryRouteMetrics }>;
  createdAt: string;
  admittedRouteSourceRevision: string;
}>;

export type RecoveryPlan = Readonly<RecoveryPlanPayload & { fingerprint: `sha256:${string}` }>;

export type ApprovalGrant = Readonly<{
  planId: string;
  fingerprint: `sha256:${string}`;
  scenarioRevision: number;
  approvedAt: string;
  approvedBy: "human-ui";
  used: false;
}>;

export type OperationalRecoverySnapshot = Readonly<{
  scenarioRevision: number;
  workflowStatus: RecoveryWorkflowStatus;
  incident: RecoveryIncident;
  plan: RecoveryPlan | null;
  approvalGrant: ApprovalGrant | null;
}>;

export type RecoveryAgentCapability = Readonly<{
  compareOptions(): RecoveryResult<Unit211PreDispatchData>;
  stagePlan(input: unknown): Promise<RecoveryResult<RecoveryPlan>>;
  requestReview(input: unknown): RecoveryResult<OperationalRecoverySnapshot>;
  planStatus(): RecoveryResult<OperationalRecoverySnapshot>;
}>;

export type RecoveryHumanCapability = Readonly<{
  approvePlan(input: unknown): RecoveryResult<ApprovalGrant>;
  rejectPlan(input: unknown): RecoveryResult<OperationalRecoverySnapshot>;
}>;

export function recoveryFailure<T>(code: RecoveryErrorCode, message: string, actions: readonly RecoveryAction[]): RecoveryResult<T> {
  return { ok: false, error: { code, message, actions: [...actions] } };
}

export function recoverySuccess<T>(data: T): RecoveryResult<T> {
  return { ok: true, data };
}
