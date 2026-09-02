import { useEffect, useState, type ReactNode } from "react";
import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { OperationalRecoverySnapshot, RecoveryAgentCapability, RecoveryExecutionCapability, RecoveryResult } from "../../domain/recovery/recoveryContracts";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { createOperationalTools } from "./registerOperationalTools";
import { createRecoveryTools } from "./registerRecoveryTools";
import type { WebMcpTool } from "./webMcpTypes";
import { assertUniqueToolNames } from "./toolRegistry";

type WebMcpGateState = "checking" | "registering" | "ready" | "simulation" | "unsupported" | "failed";

type WebMcpGateProps = {
  children: ReactNode;
  explicitFlag: string | undefined;
  locale: Locale;
  onScenarioChange?(scenario: OperatingRegion): void;
  operations: OperationsApi;
  recoveryAgent: RecoveryAgentCapability;
  recoveryExecution: RecoveryExecutionCapability;
  operational: Readonly<{ read(): RecoveryResult<OperationalRecoverySnapshot>; subscribe(listener: (snapshot: OperationalRecoverySnapshot) => void): () => void }>;
};

export function WebMcpGate({ children, explicitFlag, locale, onScenarioChange, operations, operational, recoveryAgent, recoveryExecution }: WebMcpGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WebMcpGateState>("checking");
  const copy = catalog(locale);

  useEffect(() => {
    const controllers = new Map<string, AbortController>();
    let unsubscribe = (): void => undefined;
    let isStopped = false;
    let hasFailed = false;
    const abortAll = (): void => {
      isStopped = true;
      unsubscribe();
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
    const fail = (): void => {
      if (isStopped || hasFailed) return;
      hasFailed = true;
      abortAll();
      setState("failed");
    };
    const abort = (): void => abortAll();
    window.addEventListener("beforeunload", abort);

    async function register(): Promise<void> {
      if (import.meta.env.DEV && explicitFlag === "true") {
        setState("ready");
        return;
      }

      const modelContext = document.modelContext;
      if (modelContext === undefined) {
        if (import.meta.env.DEV && explicitFlag !== "false") {
          const opsTools = createOperationalTools(operations, onScenarioChange);
          let recTools: WebMcpTool[] = [];

          const updateWindowTools = () => {
            (window as unknown as { __recoveryTools: WebMcpTool[] }).__recoveryTools = [...opsTools, ...recTools];
          };

          const schedule = (snapshot: OperationalRecoverySnapshot): void => {
            if (isStopped) return;
            recTools = createRecoveryTools(snapshot, { operations, recoveryAgent, recoveryExecution, onScenarioChange });
            updateWindowTools();
          };

          unsubscribe = operational.subscribe(schedule);
          if (isStopped) {
            unsubscribe();
            return;
          }
          const initial = operational.read();
          if (!initial.ok) throw new Error("Recovery state is unavailable.");
          schedule(initial.data);
          setState("simulation");
          return;
        }
        setState("unsupported");
        return;
      }
      const availableModelContext = modelContext;

      setState("registering");
      try {
        async function addTools(tools: readonly WebMcpTool[]): Promise<void> {
          assertUniqueToolNames(tools);
          const additions: string[] = [];
          try {
            for (const tool of tools) {
              if (isStopped) return;
              if (controllers.has(tool.name)) continue;
              const controller = new AbortController();
              controllers.set(tool.name, controller);
              additions.push(tool.name);
              await availableModelContext.registerTool(tool, { signal: controller.signal });
              if (isStopped || controller.signal.aborted) {
                controller.abort();
                if (controllers.get(tool.name) === controller) controllers.delete(tool.name);
              }
            }
          } catch (error) {
            for (const name of additions) {
              controllers.get(name)?.abort();
              controllers.delete(name);
            }
            throw error;
          }
        }

        async function reconcile(snapshot: OperationalRecoverySnapshot): Promise<void> {
          const tools = createRecoveryTools(snapshot, { operations, recoveryAgent, recoveryExecution, onScenarioChange });
          assertUniqueToolNames(tools);
          const desired = new Set(tools.map(({ name }) => name));
          for (const name of desired) if (controllers.has(name) && !name.startsWith("recovery_")) throw new Error(`Recovery tool collides with base tool: ${name}`);
          for (const [name, controller] of controllers) {
            if (!name.startsWith("recovery_") || desired.has(name)) continue;
            controller.abort();
            controllers.delete(name);
          }
          await addTools(tools);
        }

        const pendingSnapshots: OperationalRecoverySnapshot[] = [];
        let isBaseReady = false;
        let reconcileQueue = Promise.resolve();
        const schedule = (snapshot: OperationalRecoverySnapshot): void => {
          if (isStopped) return;
          if (!isBaseReady) {
            pendingSnapshots.push(snapshot);
            return;
          }
          reconcileQueue = reconcileQueue.then(() => isStopped ? undefined : reconcile(snapshot)).catch(() => fail());
        };

        unsubscribe = operational.subscribe(schedule);
        if (isStopped) {
          unsubscribe();
          return;
        }
        const initial = operational.read();
        if (!initial.ok) throw new Error("Recovery state is unavailable.");
        schedule(initial.data);
        await addTools(createOperationalTools(operations, onScenarioChange));
        if (isStopped) return;
        isBaseReady = true;
        for (const snapshot of pendingSnapshots.splice(0)) schedule(snapshot);
        let observed = reconcileQueue;
        let isSettled = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          await observed;
          if (isStopped) return;
          const next = reconcileQueue;
          if (next === observed) {
            isSettled = true;
            break;
          }
          observed = next;
        }
        if (!isSettled) throw new Error("WebMCP recovery registration did not settle.");
        if (!isStopped) setState("ready");
      } catch {
        fail();
      }
    }

    void register();
    return () => {
      window.removeEventListener("beforeunload", abort);
      abortAll();
    };
  }, [attempt, explicitFlag, onScenarioChange, operational, operations, recoveryAgent, recoveryExecution]);

  if (state === "ready" || state === "simulation") {
    return (
      <>
        {state === "simulation" && (
          <div className="webmcp-simulation-banner" style={{ backgroundColor: "#ffcc00", color: "#000", padding: "8px", textAlign: "center", fontWeight: "bold" }}>
            ⚠️ DEV MODE — WebMCP Unavailable (Simulation Only)
          </div>
        )}
        {children}
      </>
    );
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
