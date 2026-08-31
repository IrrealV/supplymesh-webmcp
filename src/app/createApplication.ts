import { createOperationsApi, type OperationsApi } from "../domain/operations/createOperationsApi";
import { createRecoveryAgentCapability, createRecoveryHumanCapability } from "../domain/recovery/createRecoveryCapabilities";
import { browserSha256Crypto, type Sha256Crypto } from "../domain/recovery/canonicalJson";
import type { OperationalRecoverySnapshot, RecoveryAgentCapability, RecoveryHumanCapability, RecoveryResult } from "../domain/recovery/recoveryContracts";
import { clearanceAlternativeCatalog } from "../scenario/fixtures/clearanceAlternativeCatalog";
import { browserStorage, type StorageLike } from "../scenario/persistence/overrideStorage";
import { createZustandScenarioRepository } from "../scenario/state/createZustandScenarioRepository";

export function createApplication(): OperationsApi {
  return createOperationsApi(createZustandScenarioRepository(), {
    readAlternativeCatalog: () => clearanceAlternativeCatalog,
    admittedAlternativeCatalog: clearanceAlternativeCatalog,
  });
}

export type RecoveryApplication = Readonly<{
  operations: OperationsApi;
  recoveryAgent: RecoveryAgentCapability;
  recoveryHuman: RecoveryHumanCapability;
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
  const repository = createZustandScenarioRepository(options.storage ?? browserStorage(), cryptoCapability);
  const readAlternativeCatalog = options.readAlternativeCatalog ?? (() => clearanceAlternativeCatalog);
  const admittedAlternativeCatalog = options.admittedAlternativeCatalog ?? clearanceAlternativeCatalog;
  const operations = createOperationsApi(repository, { readAlternativeCatalog, admittedAlternativeCatalog });
  return {
    operations,
    recoveryAgent: createRecoveryAgentCapability(repository, operations.unit211PreDispatchContext, cryptoCapability),
    recoveryHuman: createRecoveryHumanCapability(repository),
    operational: {
      read: repository.operationalRead,
      subscribe: repository.operationalSubscribe,
    },
  };
}
