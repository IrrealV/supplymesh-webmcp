import { createOperationsApi, type OperationsApi } from "../domain/operations/createOperationsApi";
import { createRecoveryAgentCapability, createRecoveryHumanCapability } from "../domain/recovery/createRecoveryCapabilities";
import { createRecoveryExecutionCapability } from "../domain/recovery/createRecoveryExecutionCapability";
import { browserSha256Crypto, type Sha256Crypto } from "../domain/recovery/canonicalJson";
import type { OperationalRecoverySnapshot, RecoveryAgentCapability, RecoveryExecutionCapability, RecoveryHumanCapability, RecoveryResult } from "../domain/recovery/recoveryContracts";
import { clearanceAlternativeCatalog } from "../scenario/fixtures/clearanceAlternativeCatalog";
import { browserStorage, type StorageLike } from "../scenario/persistence/overrideStorage";
import { createZustandScenarioRepository } from "../scenario/state/createZustandScenarioRepository";

export function createApplication(): OperationsApi {
  return createOperationsApi(createZustandScenarioRepository(undefined, undefined, clearanceAlternativeCatalog), {
    readAlternativeCatalog: () => clearanceAlternativeCatalog,
    admittedAlternativeCatalog: clearanceAlternativeCatalog,
  });
}

export type RecoveryApplication = Readonly<{
  operations: OperationsApi;
  recoveryAgent: RecoveryAgentCapability;
  recoveryHuman: RecoveryHumanCapability;
  recoveryExecution: RecoveryExecutionCapability;
  operational: Readonly<{
    read(): RecoveryResult<OperationalRecoverySnapshot>;
    subscribe(listener: (snapshot: OperationalRecoverySnapshot) => void): () => void;
  }>;
}>;

export type RecoveryApplicationOptions = Readonly<{
  storage?: StorageLike;
  cryptoCapability?: Sha256Crypto | null;
  readAlternativeCatalog?: () => unknown;
  admittedAlternativeCatalog?: unknown;
}>;

export function createRecoveryApplication(options: RecoveryApplicationOptions = {}): RecoveryApplication {
  const cryptoCapability = options.cryptoCapability === undefined ? browserSha256Crypto() : options.cryptoCapability;
  const readAlternativeCatalog = options.readAlternativeCatalog ?? (() => clearanceAlternativeCatalog);
  const admittedAlternativeCatalog = options.admittedAlternativeCatalog ?? clearanceAlternativeCatalog;
  const repository = createZustandScenarioRepository(options.storage ?? browserStorage(), cryptoCapability, admittedAlternativeCatalog);
  const operations = createOperationsApi(repository, { readAlternativeCatalog, admittedAlternativeCatalog });
  return {
    operations,
    recoveryAgent: createRecoveryAgentCapability(repository, operations.unit211PreDispatchContext, cryptoCapability),
    recoveryHuman: createRecoveryHumanCapability(repository),
    recoveryExecution: createRecoveryExecutionCapability(repository, operations.unit211PreDispatchContext, readAlternativeCatalog, cryptoCapability),
    operational: {
      read: repository.operationalRead,
      subscribe: repository.operationalSubscribe,
    },
  };
}
