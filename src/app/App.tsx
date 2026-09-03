import { useState } from "react";
import type { OperatingRegion } from "../domain/entities";
import { createLiveConditionsStore } from "../live/liveConditions";
import { loadInitialLocale, saveLocale, browserLocaleStorage } from "../preferences/i18n/localeStorage";
import type { Locale } from "../preferences/i18n/catalog";
import { WebMcpGate } from "../platform/webmcp/WebMcpGate";
import { OperationalShell } from "../features/shell/OperationalShell";
import { createRecoveryApplication } from "./createApplication";
import { createZustandRecoveryRepository } from "../domain/recovery/createZustandRecoveryRepository";

const application = createRecoveryApplication();
const { operations } = application;
const liveConditions = createLiveConditionsStore(() => operations.scenarioCurrent());

export function App() {
  const [locale, setLocale] = useState<Locale>(() => loadInitialLocale(browserLocaleStorage(), navigator.language));
  const [scenario, setScenario] = useState<OperatingRegion>(() => {
    const result = operations.scenarioCurrent();
    if (!result.ok) throw new Error(result.error.code);
    return result.data;
  });
  const handleLocaleChange = (nextLocale: Locale): void => { saveLocale(browserLocaleStorage(), nextLocale); setLocale(nextLocale); };
  return <WebMcpGate explicitFlag={import.meta.env.VITE_WEBMCP_LOCAL_BYPASS} liveConditions={liveConditions} locale={locale} operational={application.operational} operations={operations} recoveryAgent={application.recoveryAgent} recoveryExecution={application.recoveryExecution}>
    <OperationalShell liveConditions={liveConditions} locale={locale} onLocaleChange={handleLocaleChange} onScenarioChange={setScenario} operational={application.operational} operations={operations} recoveryAgent={application.recoveryAgent} recoveryExecution={application.recoveryExecution} recoveryHuman={application.recoveryHuman} scenario={scenario} />
  </WebMcpGate>;
}

export function createTestApplication() {
  return createRecoveryApplication({ recoveryRepository: createZustandRecoveryRepository({ storage: undefined }) });
}
