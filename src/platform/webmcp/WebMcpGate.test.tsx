import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createRecoveryApplication } from "../../app/createApplication";
import type { WebMcpTool } from "./webMcpTypes";
import { WebMcpGate } from "./WebMcpGate";
import { assertUniqueToolNames } from "./toolRegistry";

type Registration = { signal: AbortSignal; tool: WebMcpTool };

class MemoryStorage {
  getItem(): string | null {
    return null;
  }

  setItem(): void {}
}

function application() {
  return createRecoveryApplication({ storage: new MemoryStorage() });
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

    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);

    await screen.findByText("Operational console");
    expect(registrations).toHaveLength(13);
    expect(registrations.map((registration) => registration.tool.name)).toEqual(["scenario_current", "scenario_region_select", "avoidance_area_set", "fleet_status", "vehicle_get", "vehicle_rename", "fleet_vehicle_create", "fleet_vehicle_update", "fleet_vehicle_assign_route", "fleet_vehicle_delete", "recovery_operations_context", "recovery_options_compare", "recovery_plan_stage"]);
    expect(new Set(registrations.map((registration) => registration.signal)).size).toBe(13);
  });

  it("should block unsupported access with only an accessible explanation and retry", async () => {
    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);

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
    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    await screen.findByText("Operational console");
    expect(registrations).toHaveLength(14);
    expect(registrations[0].signal.aborted).toBe(true);
    expect(new Set(registrations.slice(1).map((registration) => registration.signal)).size).toBe(13);
  });

  it("should abort the active registration controller on unload", async () => {
    const registrations: Registration[] = [];
    setModelContext((tool, { signal }) => {
      registrations.push({ tool, signal });
    });
    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);

    await waitFor(() => expect(registrations).toHaveLength(13));
    window.dispatchEvent(new Event("beforeunload"));

    expect(registrations.every((registration) => registration.signal.aborted)).toBe(true);
  });

  it("should reconcile exact recovery tools with isolated signals and retire execute immediately", async () => {
    const registrations: Registration[] = [];
    const active = new Map<string, Registration>();
    setModelContext((tool, { signal }) => {
      const registration = { tool, signal };
      registrations.push(registration);
      active.set(tool.name, registration);
      signal.addEventListener("abort", () => active.delete(tool.name), { once: true });
    });
    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);
    await screen.findByText("Operational console");

    const plan = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    if (!plan.ok) throw new Error("Plan staging failed.");
    await waitFor(() => expect([...active.keys()].sort()).toStrictEqual(["avoidance_area_set", "fleet_status", "fleet_vehicle_assign_route", "fleet_vehicle_create", "fleet_vehicle_delete", "fleet_vehicle_update", "recovery_operations_context", "recovery_plan_request_review", "recovery_plan_status", "recovery_reset", "scenario_current", "scenario_region_select", "vehicle_get", "vehicle_rename"]));
    const contextRegistration = registrations.find(({ tool }) => tool.name === "recovery_operations_context");
    const compareRegistration = registrations.find(({ tool }) => tool.name === "recovery_options_compare");
    expect(contextRegistration?.signal.aborted).toBe(false);
    expect(compareRegistration?.signal.aborted).toBe(true);

    app.recoveryAgent.requestReview({ planId: plan.data.planId });
    app.recoveryHuman.approvePlan({ planId: plan.data.planId });
    await waitFor(() => expect(active.has("recovery_plan_execute")).toBe(true));
    const executeRegistration = active.get("recovery_plan_execute");
    if (executeRegistration === undefined) throw new Error("Execute registration is unavailable.");
    const executed = await executeRegistration.tool.execute({ planId: plan.data.planId });
    expect(JSON.parse(executed.content[0].text)).toMatchObject({ ok: true, data: { status: "EXECUTED" } });
    await waitFor(() => expect(active.has("recovery_plan_execute")).toBe(false));
    expect(executeRegistration.signal.aborted).toBe(true);
    expect(active.has("recovery_verify")).toBe(true);
    expect([...active.keys()].some((name) => /approve|reject/i.test(name))).toBe(false);
  });

  it("should roll back a failed dynamic addition and keep production access blocked", async () => {
    const registrations: Registration[] = [];
    setModelContext((tool, { signal }) => {
      registrations.push({ tool, signal });
      if (tool.name === "recovery_plan_status") throw new Error("dynamic registration failed");
    });
    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);
    await screen.findByText("Operational console");

    await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });

    await screen.findByRole("alert");
    expect(screen.queryByText("Operational console")).toBeNull();
    expect(registrations.every(({ signal }) => signal.aborted)).toBe(true);
    expect(registrations.filter(({ tool }) => tool.name === "recovery_plan_status")).toHaveLength(1);
  });

  it("should preserve a transition that occurs during delayed initial registration", async () => {
    const registrations: Registration[] = [];
    const active = new Map<string, Registration>();
    let release = (): void => undefined;
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    setModelContext(async (tool, { signal }) => {
      const registration = { tool, signal };
      registrations.push(registration);
      active.set(tool.name, registration);
      signal.addEventListener("abort", () => active.delete(tool.name), { once: true });
      if (tool.name === "scenario_current") await delayed;
    });
    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);
    await waitFor(() => expect(registrations).toHaveLength(1));

    const staged = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    if (!staged.ok) throw new Error("Plan staging failed.");
    release();

    await screen.findByText("Operational console");
    await waitFor(() => expect([...active.keys()].sort()).toStrictEqual(["avoidance_area_set", "fleet_status", "fleet_vehicle_assign_route", "fleet_vehicle_create", "fleet_vehicle_delete", "fleet_vehicle_update", "recovery_operations_context", "recovery_plan_request_review", "recovery_plan_status", "recovery_reset", "scenario_current", "scenario_region_select", "vehicle_get", "vehicle_rename"]));
    expect(active.has("recovery_options_compare")).toBe(false);
    expect(active.has("recovery_plan_stage")).toBe(false);
  });

  it("should serialize rapid transitions while a dynamic registration is delayed", async () => {
    const active = new Map<string, Registration>();
    let release = (): void => undefined;
    let markStarted = (): void => undefined;
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    setModelContext(async (tool, { signal }) => {
      const registration = { tool, signal };
      active.set(tool.name, registration);
      signal.addEventListener("abort", () => active.delete(tool.name), { once: true });
      if (tool.name === "recovery_plan_status") {
        markStarted();
        await delayed;
      }
    });
    const app = application();
    render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);
    await screen.findByText("Operational console");
    const plan = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    if (!plan.ok) throw new Error("Plan staging failed.");
    await started;

    app.recoveryAgent.requestReview({ planId: plan.data.planId });
    app.recoveryHuman.approvePlan({ planId: plan.data.planId });
    release();

    await waitFor(() => expect([...active.keys()].sort()).toStrictEqual(["avoidance_area_set", "fleet_status", "fleet_vehicle_assign_route", "fleet_vehicle_create", "fleet_vehicle_delete", "fleet_vehicle_update", "recovery_operations_context", "recovery_plan_execute", "recovery_plan_status", "recovery_reset", "scenario_current", "scenario_region_select", "vehicle_get", "vehicle_rename"]));
    expect(active.has("recovery_plan_request_review")).toBe(false);
  });

  it("should not leak a late tool or subscription after unmount during registration", async () => {
    const registrations: Registration[] = [];
    let release = (): void => undefined;
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    setModelContext(async (tool, { signal }) => {
      registrations.push({ tool, signal });
      if (tool.name === "scenario_current") await delayed;
    });
    const app = application();
    const view = render(<WebMcpGate explicitFlag="false" locale="en" operational={app.operational} operations={app.operations} recoveryAgent={app.recoveryAgent} recoveryExecution={app.recoveryExecution}><div>Operational console</div></WebMcpGate>);
    await waitFor(() => expect(registrations).toHaveLength(1));

    view.unmount();
    release();
    await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });

    await waitFor(() => expect(registrations).toHaveLength(1));
    expect(registrations[0].signal.aborted).toBe(true);
    expect(screen.queryByText("Operational console")).toBeNull();
  });

  it("should reject duplicate desired tool names", () => {
    const tool: WebMcpTool = { name: "duplicate", description: "Duplicate test tool.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, execute: () => ({ content: [{ type: "text", text: "{}" }] }) };

    expect(() => assertUniqueToolNames([tool, { ...tool }])).toThrow("Duplicate WebMCP tool name: duplicate");
  });

});
