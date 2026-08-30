import type {
  Cargo,
  GeoLine,
  GeoPoint,
  GeoPolygon,
  OperatingRegion,
  RouteSummary,
} from "../entities";

export const RecoveryWorkflowStates = {
  approved: "APPROVED",
  executed: "EXECUTED",
  idle: "IDLE",
  invalidated: "INVALIDATED",
  optionsReady: "OPTIONS_READY",
  planStaged: "PLAN_STAGED",
  rejected: "REJECTED",
  reviewRequested: "REVIEW_REQUESTED",
  verificationFailed: "VERIFICATION_FAILED",
  verified: "VERIFIED",
} as const;

export type RecoveryWorkflowState =
  (typeof RecoveryWorkflowStates)[keyof typeof RecoveryWorkflowStates];
export type ValidationStatus = "PASS" | "FAIL" | "UNKNOWN";
export type ScenarioClock = {
  instant: string;
  mode: "deterministic-demo";
};

export type HumanConstraint<Name extends string, Value> = {
  hardness: "hard";
  name: Name;
  source: "human";
  value: Value;
};

export type HumanConstraints = {
  clearanceBufferMeters: HumanConstraint<"clearanceBufferMeters", number>;
  keepCargoAssignment: HumanConstraint<"keepCargoAssignment", boolean>;
  protectRestDeadline: HumanConstraint<"protectRestDeadline", boolean>;
};

export type OperationalIncident = {
  availableClearanceMeters: number;
  exclusionZone: GeoPolygon;
  id: string;
  incidentPoint: GeoPoint;
  openedAt: string;
  reasonCode: "CLEARANCE_BUFFER_VIOLATION";
  riskId: string;
  routeId: string;
  snapIndex: number;
  status: "OPEN" | "RESOLVED";
  vehicleId: string;
};

export type ClearanceValidation = {
  availableClearanceMeters: number;
  clearanceBufferMeters: number;
  reasonCode:
    | "CLEARANCE_BUFFER_VIOLATION"
    | "CLEARANCE_REQUIREMENT_SATISFIED"
    | "CLEARANCE_RESTRICTION_AVOIDED"
    | "CLEARANCE_DATA_INVALID";
  requiredClearanceMeters: number;
  status: ValidationStatus;
  vehicleHeightMeters: number;
};

export type GeometryAvoidanceValidation = {
  minimumSeparationMeters: number;
  reasonCode:
    | "EXCLUSION_ZONE_AVOIDED"
    | "EXCLUSION_ZONE_INTERSECTION"
    | "GEOMETRY_DATA_INVALID";
  status: ValidationStatus;
};

export type RestWindowValidation = {
  estimatedCompletionAt: string;
  isCompletionBeforeDeadline: boolean;
  isDurationWithinRemainingDrive: boolean;
  reasonCode:
    | "REST_WINDOW_SATISFIED"
    | "REST_WINDOW_VIOLATION"
    | "REST_WINDOW_DATA_INVALID"
    | "REST_PROTECTION_DISABLED";
  remainingDriveMinutes: number;
  remainingRouteMinutes: number;
  reserveMinutes: number;
  restDeadline: string;
  status: ValidationStatus;
};

export type CargoContinuityValidation = {
  cargoAssignmentUnchanged: boolean;
  destinationUnchanged: boolean;
  reasonCode: "CARGO_CONTINUITY_PRESERVED" | "CARGO_CONTINUITY_VIOLATION";
  status: Exclude<ValidationStatus, "UNKNOWN">;
  vehicleUnchanged: boolean;
};

export type RecoveryOptionValidation = {
  cargoContinuity: CargoContinuityValidation;
  clearance: ClearanceValidation;
  geometryAvoidance: GeometryAvoidanceValidation;
  restWindow: RestWindowValidation;
};

export type RecoveryOption = {
  currentRouteId: string;
  feasible: boolean;
  geometry: GeoLine;
  id: string;
  incidentId: string;
  kind: "CURRENT_ROUTE" | "ALTERNATIVE_ROUTE";
  metrics: {
    distanceDeltaMeters: number;
    durationDeltaSeconds: number;
    summary: RouteSummary;
  };
  reasonCodes: string[];
  risksIntroduced: string[];
  risksResolved: string[];
  routeId: string;
  validation: RecoveryOptionValidation;
  vehicleId: string;
};

export type PlanFingerprintPayload = {
  basedOnScenarioRevision: number;
  constraints: HumanConstraints;
  currentRouteId: string;
  incidentId: string;
  optionMetrics: {
    distanceMeters: number;
    durationSeconds: number;
  };
  planId: string;
  proposedRouteId: string;
  selectedOptionId: string;
  vehicleId: string;
};

export type RecoveryPlan = {
  basedOnScenarioRevision: number;
  constraints: HumanConstraints;
  createdAt: string;
  currentRouteId: string;
  fingerprint: string;
  id: string;
  incidentId: string;
  optionMetrics: {
    distanceMeters: number;
    durationSeconds: number;
  };
  proposedRouteId: string;
  selectedOptionId: string;
  status:
    | "STAGED"
    | "REVIEW_REQUESTED"
    | "APPROVED"
    | "REJECTED"
    | "INVALIDATED"
    | "EXECUTED";
  vehicleId: string;
};

export type ApprovalGrant = {
  approvedAt: string;
  approvedBy: "human-ui";
  constraints: HumanConstraints;
  currentRouteId: string;
  fingerprint: string;
  incidentId: string;
  planId: string;
  proposedRouteId: string;
  scenarioRevision: number;
  selectedOptionId: string;
  used: boolean;
  vehicleId: string;
};

export type VerificationCheckName =
  | "clearance"
  | "restWindow"
  | "cargoContinuity"
  | "approvedFingerprint"
  | "noDuplicateApplication"
  | "incidentResolved";

export type VerificationCheck = {
  name: VerificationCheckName;
  reasonCode: string;
  status: "PASS" | "FAIL";
};

export type VerificationReport = {
  checks: VerificationCheck[];
  expectedScenarioRevision: number;
  id: string;
  overall: "PASS" | "FAIL";
  planId: string;
  verifiedAt: string;
};

export type ReceiptVerificationSummary = {
  reportId: string;
  status: "PENDING" | "PASS" | "FAIL";
};

export type OperationReceipt = {
  afterRevision: number;
  appliedRouteId: string;
  approvalFingerprint: string;
  approvalSource: "human-ui";
  auditEventIds: string[];
  beforeRevision: number;
  constraints: HumanConstraints;
  executedOnce: true;
  incidentId: string;
  planId: string;
  previousRouteId: string;
  receiptId: string;
  vehicleId: string;
  verificationSummary: ReceiptVerificationSummary;
};

export type AuditEvent = {
  action: string;
  actor: "human" | "agent" | "system";
  id: string;
  reasonCode?: string;
  result: "SUCCESS" | "REJECTED";
  scenarioRevision: number;
  sequence: number;
  target: string;
  timestamp: string;
};

export type OperationalRecoverySnapshot = {
  approval?: ApprovalGrant;
  auditTimeline: AuditEvent[];
  constraints: HumanConstraints;
  fixtureVersion: "unit-211-pre-dispatch-v1";
  incident: OperationalIncident;
  options: RecoveryOption[];
  plan?: RecoveryPlan;
  receipt?: OperationReceipt;
  routeEffectCount: number;
  scenario: OperatingRegion;
  scenarioClock: ScenarioClock;
  scenarioRevision: number;
  verification?: VerificationReport;
  workflowState: RecoveryWorkflowState;
};

export type CargoAssignment = {
  cargo: Cargo;
  destinationId: string;
  vehicleId: string;
};

export type RecoveryVehicleReference = {
  fleetNumber: string;
  label: string;
  vehicleId: string;
};
