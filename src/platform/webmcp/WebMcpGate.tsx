import { useEffect, useState, type ReactNode } from "react";
import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { createOperationalTools } from "./registerOperationalTools";

type WebMcpGateState = "checking" | "registering" | "ready" | "unsupported" | "failed";

type WebMcpGateProps = {
  children: ReactNode;
  explicitFlag: string | undefined;
  onScenarioChange?(scenario: OperatingRegion): void;
  operations: OperationsApi;
};

export function WebMcpGate({ children, explicitFlag, onScenarioChange, operations }: WebMcpGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WebMcpGateState>("checking");

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
    return <main aria-live="polite" className="webmcp-gate">Checking WebMCP compatibility.</main>;
  }

  return (
    <main className="webmcp-gate">
      <p role="alert">WebMCP is required to access this console.</p>
      <button onClick={() => setAttempt((currentAttempt) => currentAttempt + 1)} type="button">Retry</button>
    </main>
  );
}
