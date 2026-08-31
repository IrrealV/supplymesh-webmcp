import type { OperatingRegion } from "../entities";
import type { OperationalRecoverySnapshot, RecoveryExecutionOutcome, RecoveryPlan, RecoveryReceipt, RecoveryResult, RecoveryVerificationReport } from "../recovery/recoveryContracts";

export type SemanticScenarioMutation = "ROUTE" | "TIMING" | "CARGO" | "RISK" | "CATALOG";

export type OperationalRecoveryRepository = {
  operationalRead(): RecoveryResult<OperationalRecoverySnapshot>;
  operationalStage(input: Readonly<{ expectedScenarioRevision: number; plan: RecoveryPlan }>): Promise<RecoveryResult<OperationalRecoverySnapshot>>;
  operationalRequestReview(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalApprove(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalReject(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalExecute(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): Promise<RecoveryResult<RecoveryExecutionOutcome>>;
  operationalVerificationRead(): RecoveryResult<Readonly<{ operational: OperationalRecoverySnapshot; scenario: OperatingRegion }>>;
  operationalVerify(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): Promise<RecoveryResult<RecoveryVerificationReport>>;
  operationalReceiptGet(input: Readonly<{ planId: string }>): RecoveryResult<RecoveryReceipt>;
  operationalReset(input: Readonly<{ expectedScenarioRevision: number }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalInvalidateForScenarioMutation(input: Readonly<{ expectedScenarioRevision: number; mutation: SemanticScenarioMutation }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalSubscribe(listener: (snapshot: OperationalRecoverySnapshot) => void): () => void;
};
