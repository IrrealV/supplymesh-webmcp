import { createOperationsApi, type OperationsApi } from "../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../scenario/state/createZustandScenarioRepository";

export function createApplication(): OperationsApi {
  return createOperationsApi(createZustandScenarioRepository());
}
