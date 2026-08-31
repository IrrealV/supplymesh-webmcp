import type { OperationalRecoverySnapshot, RecoveryPlan, RecoveryResult } from "../recovery/recoveryContracts";

export type SemanticScenarioMutation = "ROUTE" | "TIMING" | "CARGO" | "RISK" | "CATALOG";

export type OperationalRecoveryRepository = {
  operationalRead(): RecoveryResult<OperationalRecoverySnapshot>;
  operationalStage(input: Readonly<{ expectedScenarioRevision: number; plan: RecoveryPlan }>): Promise<RecoveryResult<OperationalRecoverySnapshot>>;
  operationalRequestReview(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalApprove(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalReject(input: Readonly<{ expectedScenarioRevision: number; planId: string }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalInvalidateForScenarioMutation(input: Readonly<{ expectedScenarioRevision: number; mutation: SemanticScenarioMutation }>): RecoveryResult<OperationalRecoverySnapshot>;
  operationalSubscribe(listener: (snapshot: OperationalRecoverySnapshot) => void): () => void;
};
