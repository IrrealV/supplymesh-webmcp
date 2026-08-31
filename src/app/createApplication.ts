import { createOperationsApi, type OperationsApi } from "../domain/operations/createOperationsApi";
import { clearanceAlternativeCatalog } from "../scenario/fixtures/clearanceAlternativeCatalog";
import { createZustandScenarioRepository } from "../scenario/state/createZustandScenarioRepository";

export function createApplication(): OperationsApi {
  return createOperationsApi(createZustandScenarioRepository(), {
    readAlternativeCatalog: () => clearanceAlternativeCatalog,
    admittedAlternativeCatalog: clearanceAlternativeCatalog,
  });
}
