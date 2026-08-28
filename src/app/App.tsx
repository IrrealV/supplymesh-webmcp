import { useEffect, useState } from "react";
import { createApplication } from "./createApplication";
import { OperationalShell } from "../features/shell/OperationalShell";
import { catalog, type Locale } from "../preferences/i18n/catalog";
import { browserLocaleStorage, loadLocale } from "../preferences/i18n/localeStorage";

const operations = createApplication();

export function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale(browserLocaleStorage()));
  const [result, setResult] = useState(() => operations.scenarioCurrent());
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const copy = catalog(locale);

  if (!result.ok) {
    return <main className="console-unavailable">{copy.consoleUnavailable}</main>;
  }

  return <OperationalShell locale={locale} onLocaleChange={setLocale} onScenarioChange={(scenario) => setResult({ ok: true, data: scenario })} operations={operations} scenario={result.data} />;
}
