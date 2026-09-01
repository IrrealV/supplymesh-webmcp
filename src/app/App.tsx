import { useCallback, useEffect, useState } from "react";
import { createRecoveryApplication } from "./createApplication";
import { OperationalShell } from "../features/shell/OperationalShell";
import type { OperatingRegion } from "../domain/entities";
import { catalog, type Locale } from "../preferences/i18n/catalog";
import { browserLocaleStorage, loadLocale } from "../preferences/i18n/localeStorage";
import { WebMcpGate } from "../platform/webmcp/WebMcpGate";

const application = createRecoveryApplication();
const { operations } = application;

export function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale(browserLocaleStorage()));
  const [result, setResult] = useState(() => operations.scenarioCurrent());
  const publishScenario = useCallback((scenario: OperatingRegion) => setResult({ ok: true, data: scenario }), []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const copy = catalog(locale);

  return <WebMcpGate explicitFlag={import.meta.env.VITE_WEBMCP_LOCAL_BYPASS} locale={locale} onScenarioChange={publishScenario} operational={application.operational} operations={operations} recoveryAgent={application.recoveryAgent} recoveryExecution={application.recoveryExecution}>
    {!result.ok ? <main className="console-unavailable">{copy.consoleUnavailable}</main> : <OperationalShell locale={locale} onLocaleChange={setLocale} onScenarioChange={publishScenario} operational={application.operational} operations={operations} recoveryAgent={application.recoveryAgent} recoveryExecution={application.recoveryExecution} recoveryHuman={application.recoveryHuman} scenario={result.data} />}
  </WebMcpGate>;
}
