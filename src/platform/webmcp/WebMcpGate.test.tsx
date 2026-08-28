import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import type { WebMcpTool } from "./webMcpTypes";
import { WebMcpGate } from "./WebMcpGate";

type Registration = { signal: AbortSignal; tool: WebMcpTool };

class MemoryStorage {
  getItem(): string | null {
    return null;
  }

  setItem(): void {}
}

function createOperations(): OperationsApi {
  return createOperationsApi(createZustandScenarioRepository(new MemoryStorage()));
}

function setModelContext(registerTool: (tool: WebMcpTool, options: { signal: AbortSignal }) => Promise<void> | void): void {
  document.modelContext = { registerTool };
}

describe("WebMcpGate", () => {
  afterEach(() => {
    cleanup();
    delete document.modelContext;
  });

  it("should mount the console only after all tools register through the validated seam", async () => {
    const registrations: Registration[] = [];
    setModelContext((tool, { signal }) => {
      registrations.push({ tool, signal });
    });

    render(<WebMcpGate explicitFlag="false" locale="en" operations={createOperations()}><div>Operational console</div></WebMcpGate>);

    await screen.findByText("Operational console");
    expect(registrations).toHaveLength(4);
    expect(registrations.map((registration) => registration.tool.name)).toEqual(["scenario_current", "fleet_status", "vehicle_get", "vehicle_rename"]);
    expect(new Set(registrations.map((registration) => registration.signal)).size).toBe(1);
  });

  it("should block unsupported access with only an accessible explanation and retry", async () => {
    render(<WebMcpGate explicitFlag="false" locale="en" operations={createOperations()}><div>Operational console</div></WebMcpGate>);

    expect((await screen.findByRole("alert")).textContent).toBe("WebMCP is required to access this console.");
    expect(screen.getByRole("button", { name: "Retry" })).not.toBeNull();
    expect(screen.queryByText("Operational console")).toBeNull();
    expect(screen.queryByRole("button", { name: /continue|skip|disable/i })).toBeNull();
  });

  it("should abort a failed attempt before retrying registration", async () => {
    const registrations: Registration[] = [];
    let shouldFail = true;
    setModelContext((tool, { signal }) => {
      registrations.push({ tool, signal });
      if (shouldFail) {
        shouldFail = false;
        throw new Error("registration failed");
      }
    });
    const user = userEvent.setup();
    render(<WebMcpGate explicitFlag="false" locale="en" operations={createOperations()}><div>Operational console</div></WebMcpGate>);

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    await screen.findByText("Operational console");
    expect(registrations).toHaveLength(5);
    expect(registrations[0].signal.aborted).toBe(true);
    expect(new Set(registrations.slice(1).map((registration) => registration.signal)).size).toBe(1);
  });

  it("should abort the active registration controller on unload", async () => {
    const registrations: Registration[] = [];
    setModelContext((tool, { signal }) => {
      registrations.push({ tool, signal });
    });
    render(<WebMcpGate explicitFlag="false" locale="en" operations={createOperations()}><div>Operational console</div></WebMcpGate>);

    await waitFor(() => expect(registrations).toHaveLength(4));
    window.dispatchEvent(new Event("beforeunload"));

    expect(registrations.every((registration) => registration.signal.aborted)).toBe(true);
  });

});
