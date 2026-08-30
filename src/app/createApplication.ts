import {
  createOperationsApi,
  type OperationsApi,
} from "../domain/operations/createOperationsApi";
import {
  createRecoveryApi,
  type RecoveryApi,
} from "../domain/recovery/createRecoveryApi";
import type { StorageLike } from "../scenario/persistence/overrideStorage";
import { createZustandOperationalRecoveryRepository } from "../scenario/state/createZustandOperationalRecoveryRepository";

export type ApplicationApi = OperationsApi & {
  recovery: RecoveryApi;
};

export function createApplication(storage?: StorageLike): ApplicationApi {
  const repository = createZustandOperationalRecoveryRepository(storage);
  return {
    ...createOperationsApi(repository),
    recovery: createRecoveryApi(repository),
  };
}
