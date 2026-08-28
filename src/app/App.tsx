import { useCallback, useEffect, useState } from "react";
import { createApplication } from "./createApplication";
import { OperationalShell } from "../features/shell/OperationalShell";
import type { OperatingRegion } from "../domain/entities";
import { catalog, type Locale } from "../preferences/i18n/catalog";
import { browserLocaleStorage, loadLocale } from "../preferences/i18n/localeStorage";
import { WebMcpGate } from "../platform/webmcp/WebMcpGate";

const operations = createApplication();

export function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale(browserLocaleStorage()));
  const [result, setResult] = useState(() => operations.scenarioCurrent());
  const publishScenario = useCallback((scenario: OperatingRegion) => setResult({ ok: true, data: scenario }), []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const copy = catalog(locale);

  return <WebMcpGate explicitFlag={import.meta.env.VITE_WEBMCP_LOCAL_BYPASS} onScenarioChange={publishScenario} operations={operations}>
    {!result.ok ? <main className="console-unavailable">{copy.consoleUnavailable}</main> : <OperationalShell locale={locale} onLocaleChange={setLocale} onScenarioChange={publishScenario} operations={operations} scenario={result.data} />}
  </WebMcpGate>;
}
