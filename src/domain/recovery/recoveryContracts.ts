import type {
  Unit211AlternativeOption,
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
  executed: "EXECUTED",
  verified: "VERIFIED",
  verificationFailed: "VERIFICATION_FAILED",
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
  receiptUnavailable: "RECEIPT_UNAVAILABLE",
} as const;

export type RecoveryErrorCode = (typeof RecoveryErrorCodes)[keyof typeof RecoveryErrorCodes];
export type RecoveryAction = "COMPARE_OPTIONS" | "SELECT_ADMITTED_OPTION" | "STAGE_PLAN" | "REQUEST_REVIEW" | "EXECUTE_PLAN" | "VERIFY_EXECUTION" | "GET_RECEIPT" | "RESET" | "RETRY" | "CONTACT_OPERATOR";

export type RecoveryResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: Readonly<{ code: RecoveryErrorCode; message: string; actions: readonly RecoveryAction[] }> }>;

export type RecoveryIncident = Readonly<{
  id: "incident-route-011-restriction-height-3.9";
  vehicleId: "vehicle-011";
  riskId: "restriction-height-3.9";
  routeId: "route-011";
  status: "OPEN" | "RESOLVED";
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
  admittedRouteDigest: `sha256:${string}`;
}>;

export type RecoveryPlan = Readonly<RecoveryPlanPayload & { fingerprint: `sha256:${string}` }>;

export type ApprovalGrant = Readonly<{
  planId: string;
  fingerprint: `sha256:${string}`;
  scenarioRevision: number;
  approvedAt: string;
  approvedBy: "human-ui";
  used: boolean;
}>;

export type RecoveryExecutionRecord = Readonly<{
  executionId: string;
  planId: string;
  fingerprint: `sha256:${string}`;
  approvalSource: "human-ui";
  approvedAt: string;
  beforeRevision: number;
  afterRevision: number;
  previousRouteId: "route-011";
  appliedRouteId: "alternative-route-011-clearance-v1";
  createdAt: string;
}>;

export type RecoveryExecutionEffect = Readonly<{
  effectId: string;
  executionId: string;
  planId: string;
  vehicleId: "vehicle-011";
  previousRouteId: "route-011";
  appliedRouteId: "alternative-route-011-clearance-v1";
  beforeRevision: number;
  afterRevision: number;
}>;

export const RecoveryVerificationCheckNames = [
  "UNIT_ROUTE_SINGLETON",
  "ACTIVE_ROUTE_BINDING",
  "PREVIOUS_ROUTE_ABSENT",
  "CATALOG_GEOMETRY",
  "CATALOG_SUMMARY",
  "EXCLUSION_CLEARANCE",
  "HARD_CLEARANCE_BOUND",
  "TEMPORAL_PASS",
  "CARGO_CONTINUITY",
  "PLAN_FINGERPRINT",
  "GRANT_CONSUMED",
  "SINGLE_EXECUTION_EFFECT",
  "INCIDENT_RESOLVED",
  "REVISION_INCREMENTED",
  "ROUTE_DIGEST",
] as const;

export type RecoveryVerificationCheckName = (typeof RecoveryVerificationCheckNames)[number];
export type RecoveryVerificationCheck = Readonly<{ name: RecoveryVerificationCheckName; status: "PASS" | "FAIL" }>;
export type RecoveryVerificationReport = Readonly<{
  verificationId: string;
  executionId: string;
  planId: string;
  fingerprint: `sha256:${string}`;
  status: "PASS" | "FAIL";
  checks: readonly RecoveryVerificationCheck[];
  createdAt: string;
}>;

export type RecoveryReceipt = Readonly<{
  receiptId: string;
  planId: string;
  fingerprint: `sha256:${string}`;
  approvalSource: "human-ui";
  approvedAt: string;
  beforeRevision: number;
  afterRevision: number;
  previousRouteId: "route-011";
  appliedRouteId: "alternative-route-011-clearance-v1";
  executionId: string;
  verificationReport: RecoveryVerificationReport;
  createdAt: string;
}>;

export type RecoveryExecutionOutcome = Readonly<{
  status: "EXECUTED" | "ALREADY_EXECUTED";
  execution: RecoveryExecutionRecord;
}>;

export type OperationalRecoverySnapshot = Readonly<{
  scenarioRevision: number;
  workflowStatus: RecoveryWorkflowStatus;
  incident: RecoveryIncident;
  plan: RecoveryPlan | null;
  approvalGrant: ApprovalGrant | null;
  executionRecord: RecoveryExecutionRecord | null;
  executionEffects: readonly RecoveryExecutionEffect[];
  verificationReport: RecoveryVerificationReport | null;
  receipt: RecoveryReceipt | null;
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

export type RecoveryExecutionCapability = Readonly<{
  executeApprovedPlan(input: unknown): Promise<RecoveryResult<RecoveryExecutionOutcome>>;
  verifyExecution(input: unknown): Promise<RecoveryResult<RecoveryVerificationReport>>;
  receiptGet(input: unknown): RecoveryResult<RecoveryReceipt>;
  reset(input: unknown): RecoveryResult<OperationalRecoverySnapshot>;
}>;

export type RecoveryRouteEvidencePayload = Readonly<Pick<Unit211AlternativeOption, "geometry" | "summary" | "relation" | "provenance" | "avoidsExclusionZone" | "temporalAssessment" | "cargoContinuityAssessment">>;
export type AdmittedRecoveryRoute = RecoveryRouteEvidencePayload;

export function recoveryFailure<T>(code: RecoveryErrorCode, message: string, actions: readonly RecoveryAction[]): RecoveryResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message, actions: Object.freeze([...actions]) }) });
}

export function recoverySuccess<T>(data: T): RecoveryResult<T> {
  return Object.freeze({ ok: true, data });
}
