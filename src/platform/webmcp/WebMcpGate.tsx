import { useEffect, useState, type ReactNode } from "react";
import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { createOperationalTools } from "./registerOperationalTools";

type WebMcpGateState = "checking" | "registering" | "ready" | "unsupported" | "failed";

type WebMcpGateProps = {
  children: ReactNode;
  explicitFlag: string | undefined;
  locale: Locale;
  onScenarioChange?(scenario: OperatingRegion): void;
  operations: OperationsApi;
};

export function WebMcpGate({ children, explicitFlag, locale, onScenarioChange, operations }: WebMcpGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WebMcpGateState>("checking");
  const copy = catalog(locale);

  useEffect(() => {
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    window.addEventListener("beforeunload", abort);

    async function register(): Promise<void> {
      if (import.meta.env.DEV && explicitFlag === "true") {
        setState("ready");
        return;
      }

      const modelContext = document.modelContext;
      if (modelContext === undefined) {
        setState("unsupported");
        return;
      }

      setState("registering");
      try {
        for (const tool of createOperationalTools(operations, onScenarioChange)) {
          if (controller.signal.aborted) {
            return;
          }
          await modelContext.registerTool(tool, { signal: controller.signal });
        }
        if (!controller.signal.aborted) {
          setState("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          controller.abort();
          setState("failed");
        }
      }
    }

    void register();
    return () => {
      window.removeEventListener("beforeunload", abort);
      controller.abort();
    };
  }, [attempt, explicitFlag, onScenarioChange, operations]);

  if (state === "ready") {
    return children;
  }

  if (state === "checking" || state === "registering") {
    return <main aria-live="polite" className="webmcp-gate">{copy.webMcpChecking}</main>;
  }

  return (
    <main className="webmcp-gate">
      <p role="alert">{copy.webMcpRequired}</p>
      <button onClick={() => setAttempt((currentAttempt) => currentAttempt + 1)} type="button">{copy.retry}</button>
    </main>
  );
}
