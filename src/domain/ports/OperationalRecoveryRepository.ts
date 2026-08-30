import type { Vehicle } from "../entities";
import type {
  ApprovalGrant,
  OperationReceipt,
  OperationalRecoverySnapshot,
  RecoveryOption,
  RecoveryPlan,
  RecoveryResult,
  VerificationReport,
} from "../recovery/types";
import type { ScenarioRepository } from "./ScenarioRepository";

export type OperationalRecoveryRepository = ScenarioRepository & {
  clearanceBufferSet(command: {
    clearanceBufferMeters: number;
  }): RecoveryResult<OperationalRecoverySnapshot>;
  operationReceiptGet(command: {
    planId: string;
  }): RecoveryResult<OperationReceipt>;
  recoveryOptionsCompare(): RecoveryResult<RecoveryOption[]>;
  recoveryPlanApprove(command: {
    planId: string;
  }): RecoveryResult<ApprovalGrant>;
  recoveryPlanExecute(command: {
    fingerprint: string;
    planId: string;
    proposedRouteId: string;
    vehicleId: string;
  }): RecoveryResult<OperationReceipt>;
  recoveryPlanReject(command: {
    planId: string;
  }): RecoveryResult<RecoveryPlan>;
  recoveryPlanRequestReview(command: {
    planId: string;
  }): RecoveryResult<RecoveryPlan>;
  recoveryPlanStage(command: {
    selectedOptionId: string;
  }): RecoveryResult<RecoveryPlan>;
  recoveryReset(): RecoveryResult<OperationalRecoverySnapshot>;
  recoverySnapshot(): OperationalRecoverySnapshot;
  recoveryVerify(command: {
    planId: string;
  }): RecoveryResult<VerificationReport>;
  subscribeRecovery(
    listener: (snapshot: OperationalRecoverySnapshot) => void,
  ): () => void;
  vehicleGet(vehicleId: string): Vehicle | undefined;
};
